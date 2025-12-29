import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Analyze website changes using AI
export const analyzeChange = internalAction({
  args: {
    userId: v.id("users"),
    scrapeResultId: v.id("scrapeResults"),
    websiteName: v.string(),
    websiteUrl: v.string(),
    diff: v.object({
      text: v.string(),
      json: v.any(),
    }),
    links: v.optional(v.array(v.string())), // Accept links from Firecrawl
  },
  handler: async (ctx: any, args: any) => {
    // Get user's AI settings
    const userSettings = await ctx.runQuery(internal.userSettings.getUserSettingsInternal, {
      userId: args.userId,
    });

    if (!userSettings || !userSettings.aiAnalysisEnabled || !userSettings.aiApiKey) {
      console.log("AI analysis not enabled or API key not set for user:", args.userId);
      return;
    }

    const systemPrompt = userSettings.aiSystemPrompt || `You are an AI assistant specialized in analyzing website changes for a tender monitoring system. Your task is to determine if a detected change indicates a NEW tender, call for proposals, or call for expressions of interest.

Meaningful changes include:
- New "Appel d'offre" (Tender)
- New "Appel à manifestation d'intérêt" (Call for Expression of Interest)
- New "Avis de consultation"
- New funding opportunities or grants
- Updates to existing tender deadlines or requirements

NOT meaningful (ignore these):
- Minor text corrections
- Date updates not related to deadlines
- Layout changes
- Menu updates
- Footer/Header changes
- General news not related to tenders

IMPORTANT: If you detect a new tender/opportunity, identify ALL relevant links for detailed information.
- I have provided a numbered list of "Potential Links".
- You MUST return the INDEX (number) of the relevant link(s) from that list.
- Do NOT return the URL string itself, only the index.
- Look for Markdown links like [Title](https://...) or raw URLs
- Ignore image links (jpg, png, svg, etc.)
- Ignore CSS/JS file links
- Ignore generic navigation links
- Look for links to detail pages, PDF documents, or dedicated tender pages

Analyze the provided diff and return a JSON response with:
{
  "score": 0-100 (how likely this is a new tender/opportunity),
  "isMeaningful": true/false,
  "reasoning": "Brief explanation of your decision (EN FRANÇAIS)",
  "relevantLinkIndices": [1, 5] // Array of numbers corresponding to the indices in the "Potential Links" list. Return empty array if none found.
}

IMPORTANT: Le champ "reasoning" DOIT être rédigé en FRANÇAIS.`;

    try {
      // Use custom base URL if provided, otherwise default to OpenAI
      const baseUrl = userSettings.aiBaseUrl || "https://api.openai.com/v1";
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

      // Extract and log all URLs in the diff for debugging
      const urlRegex = /(https?:\/\/[^\s\)]+|\/[^\s\)]+)/g;
      const textUrls = args.diff.text.match(urlRegex) || [];

      // Also try to extract URLs from diff.json if available
      let jsonUrls: string[] = [];
      if (args.diff.json) {
        try {
          const jsonString = JSON.stringify(args.diff.json);
          jsonUrls = jsonString.match(urlRegex) || [];
        } catch (e) {
          console.error("Failed to extract URLs from diff.json:", e);
        }
      }

      // Combine URLs from diff text, diff json, and explicit links from Firecrawl
      const pageLinks = args.links || [];
      const allUrls = [...new Set([...textUrls, ...jsonUrls, ...pageLinks])]; // Deduplicate

      // Create a numbered list for the AI
      const numberedLinks = allUrls.map((url, index) => `${index}. ${url}`).join('\n');

      console.log(`[DEBUG] URLs source - Text: ${textUrls.length}, JSON: ${jsonUrls.length}, Page Links: ${pageLinks.length}`);
      console.log(`[DEBUG] Total Unique URLs available to AI: ${allUrls.length}`);

      console.log(`[DEBUG] Diff sent to AI (length: ${args.diff.text.length} chars):`);
      console.log(args.diff.text);

      // Call AI API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${userSettings.aiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: userSettings.aiModel || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: `Website: ${args.websiteName} (${args.websiteUrl})
              
Changes detected:
${args.diff.text}

Potential Links (Select by INDEX):
${numberedLinks}

Please analyze these changes and determine if they are meaningful.`,
            },
          ],
          temperature: 0.1, // Lower temperature for more deterministic output
          max_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("AI API error:", error);
        return;
      }

      const data = await response.json();
      const rawContent = data.choices[0].message.content;
      console.log(`[DEBUG] Raw Initial AI Response: ${rawContent}`);

      let aiResponse;
      try {
        aiResponse = JSON.parse(rawContent);
      } catch (e) {
        console.error("Failed to parse initial AI response:", e);
        console.error("Raw content was:", rawContent);
        return;
      }

      console.log(`[DEBUG] Complete AI Response: ${JSON.stringify(aiResponse)}`);

      // Validate response structure
      if (typeof aiResponse.score !== "number" ||
        typeof aiResponse.isMeaningful !== "boolean" ||
        typeof aiResponse.reasoning !== "string") {
        console.error("Invalid AI response format:", aiResponse);
        return;
      }

      // Apply threshold
      const threshold = userSettings.aiMeaningfulChangeThreshold || 70;
      let isMeaningful = aiResponse.score >= threshold;
      let reasoning = aiResponse.reasoning;

      // --- DEEP ANALYSIS START ---
      // Check if deep analysis is enabled for this website
      const scrapeResult = await ctx.runQuery(internal.websites.getScrapeResult, {
        scrapeResultId: args.scrapeResultId,
      });

      if (scrapeResult) {
        const website = await ctx.runQuery(internal.websites.getWebsite, {
          websiteId: scrapeResult.websiteId,
          userId: args.userId,
        });

        if (website && website.deepAnalysisEnabled && userSettings.goNoGoRules) {
          console.log(`Deep analysis enabled for ${args.websiteName}. Checking for AI-identified links...`);

          // Use the AI-identified relevant links
          // Support both array of indices (new format) and strings (legacy/fallback)
          let targetUrls: string[] = [];

          if (Array.isArray(aiResponse.relevantLinkIndices)) {
            // Map indices back to URLs
            targetUrls = aiResponse.relevantLinkIndices
              .map((index: any) => allUrls[Number(index)])
              .filter((url: string | undefined) => url !== undefined);
          } else if (Array.isArray(aiResponse.relevantLinks)) {
            // Fallback for legacy string array
            targetUrls = aiResponse.relevantLinks.filter((url: any) => typeof url === 'string' && url !== "null" && url.length > 0);
          } else if (typeof aiResponse.relevantLink === 'string' && aiResponse.relevantLink !== "null") {
            // Fallback for legacy single string
            targetUrls = [aiResponse.relevantLink];
          }

          console.log(`[DEBUG] AI Response relevantLinks: ${JSON.stringify(targetUrls)}`);

          if (targetUrls.length > 0) {
            // Deduplication: Check which URLs have already been analyzed
            const newTargetUrls: string[] = [];
            for (const url of targetUrls) {
              const existingAnalysis = await ctx.runQuery(internal.websites.getAnalyzedOpportunity, {
                url: url,
                userId: args.userId,
              });

              // If analyzed in the last 30 days, skip it
              const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
              if (existingAnalysis && existingAnalysis.analyzedAt > thirtyDaysAgo) {
                console.log(`[Deep Analysis] Skipping duplicate URL (analyzed at ${new Date(existingAnalysis.analyzedAt).toISOString()}): ${url}`);
              } else {
                newTargetUrls.push(url);
              }
            }

            if (newTargetUrls.length === 0) {
              console.log(`[Deep Analysis] All identified links have been analyzed recently. Skipping deep analysis.`);
              isMeaningful = false; // Override to false if only duplicates found
              reasoning += "\n\n(Note : De nouvelles opportunités ont été détectées mais ignorées car elles ont été analysées récemment.)";
            } else {
              console.log(`Performing deep analysis on ${newTargetUrls.length} new links (out of ${targetUrls.length} identified).`);

              // Process links in parallel (with a limit if needed, but 10-12 is fine for now)
              const deepAnalysisResults = await Promise.all(newTargetUrls.map(async (targetUrl) => {
                if (!targetUrl || !targetUrl.startsWith('http')) return null;

                try {
                  // Scrape the target URL
                  const deepContent = await ctx.runAction(internal.firecrawl.scrapeUrlForAnalysis, {
                    url: targetUrl,
                    userId: args.userId,
                  });

                  if (!deepContent) {
                    console.error(`[Deep Analysis] Failed to scrape content from ${targetUrl}`);
                    return { url: targetUrl, error: "Failed to scrape" };
                  }

                  // Run Go/No Go Analysis
                  const systemInstruction = `You are an expert analyst.
  Evaluate the opportunity based STRICTLY on the provided rules.
  1. Assign a score from 0 to 100 based on how well it matches the criteria.
  2. Determine if it is a "GO" (score >= 50) or "NO GO" (score < 50).
  3. Provide a concise explanation for the score (IN FRENCH).
  
  Return JSON:
  {
    "score": number, // 0-100
    "isGo": boolean,
    "reasoning": "Concise explanation based on the rules (IN FRENCH)"
  }`;

                  const userContent = `User's Go/No Go Rules:
  "${userSettings.goNoGoRules}"
  
  Content of the linked page (${targetUrl}):
  ${deepContent.substring(0, 15000)}`;

                  const deepResponse = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${userSettings.aiApiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      model: userSettings.aiModel || "gpt-4o-mini",
                      messages: [
                        { role: "system", content: systemInstruction },
                        { role: "user", content: userContent }
                      ],
                      temperature: 0.1,
                      response_format: { type: "json_object" },
                    }),
                  });

                  if (deepResponse.ok) {
                    const deepData = await deepResponse.json();
                    const rawContent = deepData.choices[0].message.content;
                    const deepResult = JSON.parse(rawContent);

                    // Store the analysis result to prevent future duplicates
                    await ctx.runMutation(internal.websites.storeAnalyzedOpportunity, {
                      url: targetUrl,
                      userId: args.userId,
                      websiteId: scrapeResult.websiteId,
                      status: deepResult.isGo ? "meaningful" : "not_meaningful",
                      score: deepResult.score,
                    });

                    return {
                      url: targetUrl,
                      ...deepResult
                    };
                  } else {
                    return { url: targetUrl, error: "AI API error" };
                  }
                } catch (e) {
                  console.error(`[Deep Analysis] Error analyzing ${targetUrl}:`, e);
                  return { url: targetUrl, error: "Exception during analysis" };
                }
              }));

              // Filter out nulls and errors
              const validResults = deepAnalysisResults.filter((r: any) => r && !r.error);

              console.log(`====== GO/NO GO ANALYSIS RESULTS (${validResults.length}) ======`);

              if (validResults.length > 0) {
                // Aggregate results
                const goResults = validResults.filter((r: any) => r.isGo);
                const bestResult = validResults.reduce((prev: any, current: any) => (prev.score > current.score) ? prev : current, validResults[0]);

                // Construct consolidated reasoning
                let consolidatedReasoning = ``;

                validResults.forEach((r: any) => {
                  const icon = r.isGo ? '✅' : '❌';
                  consolidatedReasoning += `${icon} [${r.score}/100]\n<${r.url}|Voir l'annonce>\n${r.reasoning}\n\n`;
                });

                // consolidatedReasoning += `Original Change: ${reasoning}`;

                // OVERRIDE the main analysis
                if (goResults.length > 0) {
                  isMeaningful = true;
                  reasoning = consolidatedReasoning;
                  // Use the score of the best result
                  aiResponse.score = bestResult.score;
                } else {
                  isMeaningful = false; // Suppress notification if ALL are NO GO
                  reasoning = consolidatedReasoning;
                  aiResponse.score = bestResult.score;
                }
              }
            }
          }
        }
      }
      // --- DEEP ANALYSIS END ---
      // --- DEEP ANALYSIS END ---

      // Update the scrape result with AI analysis
      await ctx.runMutation(internal.websites.updateScrapeResultAIAnalysis, {
        scrapeResultId: args.scrapeResultId,
        analysis: {
          meaningfulChangeScore: isMeaningful ? 100 : 0, // Force score based on Go/No Go
          isMeaningfulChange: isMeaningful,
          reasoning: reasoning,
          analyzedAt: Date.now(),
          model: userSettings.aiModel || "gpt-4o-mini",
        },
      });

      console.log(`AI analysis complete for ${args.websiteName}: Meaningful: ${isMeaningful}`);

      // Trigger AI-based notifications after analysis is complete
      // If we found duplicates and suppressed the meaningful status, we should also suppress the notification
      const shouldSuppressNotification = !isMeaningful && reasoning.includes("New opportunities were detected but skipped because they were already analyzed recently");

      console.log(`[AI Analysis] Analysis complete. Result: ${isMeaningful ? "MEANINGFUL" : "NOT MEANINGFUL"}. Score: ${isMeaningful ? 100 : 0}. Suppress Notification: ${shouldSuppressNotification}`);

      await ctx.scheduler.runAfter(0, internal.aiAnalysis.handleAIBasedNotifications, {
        userId: args.userId,
        scrapeResultId: args.scrapeResultId,
        websiteName: args.websiteName,
        websiteUrl: args.websiteUrl,
        isMeaningful,
        diff: args.diff,
        aiAnalysis: {
          meaningfulChangeScore: isMeaningful ? 100 : 0,
          isMeaningfulChange: isMeaningful,
          reasoning: reasoning,
          analyzedAt: Date.now(),
          model: userSettings.aiModel || "gpt-4o-mini",
        },
        forceSuppressNotification: shouldSuppressNotification,
      });
    } catch (error) {
      console.error("[AI Analysis] CRITICAL ERROR:", error);
    }
  },
});

// Handle AI-based notifications after analysis is complete
export const handleAIBasedNotifications = internalAction({
  args: {
    userId: v.id("users"),
    scrapeResultId: v.id("scrapeResults"),
    websiteName: v.string(),
    websiteUrl: v.string(),
    isMeaningful: v.boolean(),
    diff: v.object({
      text: v.string(),
      json: v.any(),
    }),
    aiAnalysis: v.object({
      meaningfulChangeScore: v.number(),
      isMeaningfulChange: v.boolean(),
      reasoning: v.string(),
      analyzedAt: v.number(),
      model: v.string(),
    }),
    forceSuppressNotification: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    try {
      console.log(`[Notifications] Processing notifications for ${args.websiteName}. IsMeaningful: ${args.isMeaningful}, ForceSuppress: ${args.forceSuppressNotification}`);

      // If notifications are suppressed (e.g. duplicate analysis), return early
      if (args.forceSuppressNotification) {
        console.log(`[Notifications] SUPPRESSED: ForceSuppress flag is true (likely duplicate analysis).`);
        return;
      }

      // Get user settings to check notification filtering preferences
      const userSettings = await ctx.runQuery(internal.userSettings.getUserSettingsInternal, {
        userId: args.userId,
      });

      // Get website details for notifications
      const scrapeResult = await ctx.runQuery(internal.websites.getScrapeResult, {
        scrapeResultId: args.scrapeResultId,
      });

      if (!scrapeResult) {
        console.error("[Notifications] ERROR: Scrape result not found.");
        return;
      }

      const website = await ctx.runQuery(internal.websites.getWebsite, {
        websiteId: scrapeResult.websiteId,
        userId: args.userId,
      });

      if (!website || website.notificationPreference === "none") {
        console.log(`[Notifications] Skipped: Notification preference is '${website?.notificationPreference || "none"}'.`);
        return;
      }

      // Check if we should send webhook notification
      const shouldSendWebhook = (website.notificationPreference === "webhook" || website.notificationPreference === "both") &&
        website.webhookUrl &&
        (!userSettings?.webhookOnlyIfMeaningful || args.isMeaningful);

      // Check if we should send email notification
      const shouldSendEmail = (website.notificationPreference === "email" || website.notificationPreference === "both") &&
        (!userSettings?.emailOnlyIfMeaningful || args.isMeaningful);

      console.log(`[Notifications] Decision - Webhook: ${shouldSendWebhook}, Email: ${shouldSendEmail}`);
      console.log(`[Notifications] Config - WebhookURL: ${!!website.webhookUrl}, EmailOnlyIfMeaningful: ${userSettings?.emailOnlyIfMeaningful}, WebhookOnlyIfMeaningful: ${userSettings?.webhookOnlyIfMeaningful}`);

      // Send webhook notification if conditions are met
      if (shouldSendWebhook && website.webhookUrl) {
        console.log(`[Notifications] Queueing Webhook to ${website.webhookUrl}`);
        await ctx.scheduler.runAfter(0, internal.notifications.sendWebhookNotification, {
          webhookUrl: website.webhookUrl,
          websiteId: scrapeResult.websiteId,
          websiteName: website.name,
          websiteUrl: args.websiteUrl,
          scrapeResultId: args.scrapeResultId,
          changeType: "content_changed",
          changeStatus: "changed",
          diff: args.diff,
          title: scrapeResult.title,
          description: scrapeResult.description,
          markdown: scrapeResult.markdown,
          scrapedAt: scrapeResult.scrapedAt,
          aiAnalysis: args.aiAnalysis,
        });
      }

      // Send email notification if conditions are met
      if (shouldSendEmail) {
        // Get user's email configuration
        const emailConfig = await ctx.runQuery(internal.emailManager.getEmailConfigInternal, {
          userId: args.userId,
        });

        if (emailConfig?.email && emailConfig.isVerified) {
          console.log(`[Notifications] Queueing Email to ${emailConfig.email}`);
          await ctx.scheduler.runAfter(0, internal.notifications.sendEmailNotification, {
            email: emailConfig.email,
            websiteName: website.name,
            websiteUrl: args.websiteUrl,
            changeType: "content_changed",
            changeStatus: "changed",
            diff: args.diff,
            title: scrapeResult.title,
            scrapedAt: scrapeResult.scrapedAt,
            userId: args.userId,
            aiAnalysis: args.aiAnalysis,
          });
        } else {
          console.log(`[Notifications] Email skipped: No verified email config found. Email: ${emailConfig?.email}, Verified: ${emailConfig?.isVerified}`);
        }
      }

      console.log(`[Notifications] Processing complete.`);
    } catch (error) {
      console.error("[Notifications] CRITICAL ERROR:", error);
    }
  },
});