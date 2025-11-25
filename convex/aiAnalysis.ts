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

IMPORTANT: If you detect a new tender/opportunity, identify the MOST RELEVANT link for detailed information.
- Look for Markdown links like [Title](https://...) or raw URLs
- Ignore image links (jpg, png, svg, etc.)
- Ignore CSS/JS file links
- Ignore generic navigation links
- Look for links to detail pages, PDF documents, or dedicated tender pages
- If the link is relative (e.g. /tender/123), try to return it as is or reconstruct the full URL if obvious

Analyze the provided diff and return a JSON response with:
{
  "score": 0-100 (how likely this is a new tender/opportunity),
  "isMeaningful": true/false,
  "reasoning": "Brief explanation of your decision",
  "relevantLink": "URL of the most relevant page for this opportunity, or null if none found"
}`;

    try {
      // Use custom base URL if provided, otherwise default to OpenAI
      const baseUrl = userSettings.aiBaseUrl || "https://api.openai.com/v1";
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

      // Extract and log all URLs in the diff for debugging
      const urlRegex = /(https?:\/\/[^\s\)]+|\/[^\s\)]+)/g;
      const allUrls = args.diff.text.match(urlRegex) || [];
      console.log(`[DEBUG] All URLs found in diff (${allUrls.length}):`, allUrls);

      console.log(`[DEBUG] Diff sent to AI (length: ${args.diff.text.length} chars). First 500 chars: ${args.diff.text.substring(0, 500)}`);

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

Please analyze these changes and determine if they are meaningful.`,
            },
          ],
          temperature: 0.3,
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
          console.log(`Deep analysis enabled for ${args.websiteName}. Checking for AI-identified link...`);

          // Use the AI-identified relevant link instead of regex
          let targetUrl = aiResponse.relevantLink;

          console.log(`[DEBUG] AI Response relevantLink: ${targetUrl}`);
          console.log(`[DEBUG] Type: ${typeof targetUrl}, Value: ${JSON.stringify(targetUrl)}`);

          // FALLBACK: If AI found a meaningful change but no link, try to find it by scraping all page links
          if ((!targetUrl || targetUrl === "null") && isMeaningful) {
            console.log(`[FALLBACK] AI found meaningful change but no link. Scraping page links to find match...`);

            // 1. Get all links from the page
            const pageLinks = await ctx.runAction(internal.firecrawl.scrapePageLinks, {
              url: args.websiteUrl,
              userId: args.userId,
            });

            console.log(`[FALLBACK] Found ${pageLinks.length} links on page.`);
            console.log(`[FALLBACK] Links sample: ${JSON.stringify(pageLinks.slice(0, 5))}`);

            if (pageLinks.length > 0) {
              // 2. Ask AI to find the best matching link based on the reasoning/title
              const matchPrompt = `You are a link matching assistant.
I have detected a new tender/opportunity on a website.
The AI analysis described it as: "${reasoning}"

Here is the list of links found on the page:
${JSON.stringify(pageLinks.slice(0, 100))}

Identify the URL that most likely corresponds to this opportunity.
Return ONLY the URL as a raw string. If none match, return "null".`;

              console.log(`[FALLBACK] Sending match request to AI...`);

              // Use the same apiUrl construction as the main request
              const baseUrl = userSettings.aiBaseUrl || "https://api.openai.com/v1";
              const matchApiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

              const matchResponse = await fetch(matchApiUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${userSettings.aiApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: userSettings.aiModel || "gpt-4o-mini",
                  messages: [
                    { role: "system", content: "You are a helpful assistant that extracts URLs." },
                    { role: "user", content: matchPrompt }
                  ],
                  temperature: 0.1,
                }),
              });

              if (matchResponse.ok) {
                const matchData = await matchResponse.json();
                const rawMatch = matchData.choices[0].message.content;
                console.log(`[FALLBACK] Raw AI match response: ${rawMatch}`);

                const matchedLink = rawMatch.trim().replace(/['"]/g, "");

                if (matchedLink && matchedLink !== "null" && matchedLink.startsWith("http")) {
                  console.log(`[FALLBACK] AI matched link: ${matchedLink}`);
                  targetUrl = matchedLink;
                } else {
                  console.log(`[FALLBACK] AI could not match any link.`);
                }
              } else {
                console.error(`[FALLBACK] AI match request failed: ${matchResponse.status} ${matchResponse.statusText}`);
                const errorText = await matchResponse.text();
                console.error(`[FALLBACK] Error details: ${errorText}`);
              }
            }
          }

          if (targetUrl && typeof targetUrl === 'string' && targetUrl.startsWith('http')) {
            console.log(`Performing deep analysis on AI-selected link: ${targetUrl}`);

            // Scrape the target URL
            const deepContent = await ctx.runAction(internal.firecrawl.scrapeUrlForAnalysis, {
              url: targetUrl,
              userId: args.userId,
            });

            if (deepContent) {
              // Run Go/No Go Analysis
              const systemInstruction = `You are an expert analyst.
Evaluate the opportunity based STRICTLY on the provided rules.
1. Assign a score from 0 to 100 based on how well it matches the criteria.
2. Determine if it is a "GO" (score >= 50) or "NO GO" (score < 50).
3. Provide a concise explanation for the score.

Return JSON:
{
  "score": number, // 0-100
  "isGo": boolean,
  "reasoning": "Concise explanation based on the rules"
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

                console.log(`[Deep Analysis] Raw AI response: ${rawContent.substring(0, 500)}...`);

                try {
                  const deepResult = JSON.parse(rawContent);

                  console.log(`====== GO/NO GO ANALYSIS RESULT ======`);
                  console.log(`URL Analyzed: ${targetUrl}`);
                  console.log(`Score: ${deepResult.score}/100`);
                  console.log(`Decision: ${deepResult.isGo ? '✅ GO' : '❌ NO GO'}`);
                  console.log(`Reasoning: ${deepResult.reasoning}`);
                  console.log(`======================================`);

                  // OVERRIDE the main analysis
                  if (deepResult.isGo) {
                    isMeaningful = true;
                    reasoning = `[GO - SCORE: ${deepResult.score}/100]\n${deepResult.reasoning}\n\nOriginal Change: ${reasoning}`;
                  } else {
                    isMeaningful = false; // Suppress notification if it's a NO GO
                    reasoning = `[NO GO - SCORE: ${deepResult.score}/100]\n${deepResult.reasoning}\n\nOriginal Change: ${reasoning}`;
                  }
                } catch (parseError) {
                  console.error(`[Deep Analysis] Failed to parse AI response. Raw content:`, rawContent);
                  console.error(`[Deep Analysis] Parse error:`, parseError);
                  // Continue without deep analysis if parsing fails
                }
              } else {
                console.error(`[Deep Analysis] AI API error: ${deepResponse.status} ${deepResponse.statusText}`);
                const errorText = await deepResponse.text();
                console.error(`[Deep Analysis] Error details: ${errorText}`);
              }
            } else {
              console.error(`[Deep Analysis] Failed to scrape content from ${targetUrl}`);
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
      });
    } catch (error) {
      console.error("Error in AI analysis:", error);
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
  },
  handler: async (ctx: any, args: any) => {
    try {
      // Get user settings to check notification filtering preferences
      const userSettings = await ctx.runQuery(internal.userSettings.getUserSettingsInternal, {
        userId: args.userId,
      });

      // Get website details for notifications
      const scrapeResult = await ctx.runQuery(internal.websites.getScrapeResult, {
        scrapeResultId: args.scrapeResultId,
      });

      if (!scrapeResult) {
        console.error("Scrape result not found for notifications");
        return;
      }

      const website = await ctx.runQuery(internal.websites.getWebsite, {
        websiteId: scrapeResult.websiteId,
        userId: args.userId,
      });

      if (!website || website.notificationPreference === "none") {
        return;
      }

      // Check if we should send webhook notification
      const shouldSendWebhook = (website.notificationPreference === "webhook" || website.notificationPreference === "both") &&
        website.webhookUrl &&
        (!userSettings?.webhookOnlyIfMeaningful || args.isMeaningful);

      // Check if we should send email notification
      const shouldSendEmail = (website.notificationPreference === "email" || website.notificationPreference === "both") &&
        (!userSettings?.emailOnlyIfMeaningful || args.isMeaningful);

      // Send webhook notification if conditions are met
      if (shouldSendWebhook && website.webhookUrl) {
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
        }
      }

      console.log(`AI-based notifications processed for ${args.websiteName}. Webhook: ${shouldSendWebhook}, Email: ${shouldSendEmail}`);
    } catch (error) {
      console.error("Error in AI-based notifications:", error);
    }
  },
});