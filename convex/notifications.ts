import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { resend } from "./alertEmail";
import { sanitizeHtml } from "./lib/sanitize";

export const sendWebhookNotification = internalAction({
  args: {
    webhookUrl: v.string(),
    websiteId: v.id("websites"),
    websiteName: v.string(),
    websiteUrl: v.string(),
    scrapeResultId: v.id("scrapeResults"),
    changeType: v.string(),
    changeStatus: v.string(),
    diff: v.optional(v.object({
      text: v.string(),
      json: v.any(),
    })),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    markdown: v.string(),
    scrapedAt: v.number(),
    aiAnalysis: v.optional(v.object({
      meaningfulChangeScore: v.number(),
      isMeaningfulChange: v.boolean(),
      reasoning: v.string(),
      analyzedAt: v.number(),
      model: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const payload = {
      event: "website_changed",
      timestamp: new Date().toISOString(),
      website: {
        id: args.websiteId,
        name: args.websiteName,
        url: args.websiteUrl,
      },
      change: {
        detectedAt: new Date(args.scrapedAt).toISOString(),
        changeType: args.changeType,
        changeStatus: args.changeStatus,
        summary: args.diff?.text ?
          args.diff.text.substring(0, 200) + (args.diff.text.length > 200 ? "..." : "") :
          "Website content has changed",
        diff: args.diff ? {
          added: args.diff.text.split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .map(line => line.substring(1)),
          removed: args.diff.text.split('\n')
            .filter(line => line.startsWith('-') && !line.startsWith('---'))
            .map(line => line.substring(1)),
        } : undefined,
      },
      scrapeResult: {
        id: args.scrapeResultId,
        title: args.title,
        description: args.description,
        markdown: args.markdown.substring(0, 1000) + (args.markdown.length > 1000 ? "..." : ""),
      },
      aiAnalysis: args.aiAnalysis ? {
        meaningfulChangeScore: args.aiAnalysis.meaningfulChangeScore,
        isMeaningfulChange: args.aiAnalysis.isMeaningfulChange,
        reasoning: args.aiAnalysis.reasoning,
        analyzedAt: new Date(args.aiAnalysis.analyzedAt).toISOString(),
        model: args.aiAnalysis.model,
      } : undefined,
    };

    try {
      console.log(`Sending webhook to ${args.webhookUrl}`);

      // Check if it's a Slack webhook
      const isSlack = args.webhookUrl.includes('hooks.slack.com');
      let finalPayload: any = payload;

      if (isSlack) {
        console.log("Detected Slack webhook URL. Formatting payload for Slack.");

        // Helper to escape Slack special characters
        const escapeSlackMrkdwn = (text: string) => {
          return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        };

        // Helper to truncate string
        const truncate = (text: string, limit: number) => {
          if (text.length <= limit) return text;
          return text.substring(0, limit - 3) + "...";
        };
        
        // Format for Slack Block Kit
        const sanitizedWebsiteName = escapeSlackMrkdwn(args.websiteName);
        const reasoning = args.aiAnalysis?.reasoning 
          ? truncate(escapeSlackMrkdwn(args.aiAnalysis.reasoning), 3000)
          : undefined;
        
        // Status icon
        const statusIcon = args.aiAnalysis?.isMeaningfulChange ? "🚨" : "📝";

        finalPayload = {
          // Top-level text field is required/recommended as a fallback
          text: `${statusIcon} Changement Détecté : ${sanitizedWebsiteName}`,
          // @ts-ignore
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: truncate(`${statusIcon} Changement Détecté : ${args.websiteName}`, 3000),
                emoji: true
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Site Web :*\n<${args.websiteUrl}|${sanitizedWebsiteName}>`
                },
                {
                  type: "mrkdwn",
                  text: `*Date :*\n${new Date(args.scrapedAt).toLocaleString('fr-FR')}`
                }
              ]
            },
            {
              type: "divider"
            }
          ]
        };

        // Add AI Analysis if available
        if (reasoning) {
          // @ts-ignore
          finalPayload.blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: reasoning
            }
          });
          // @ts-ignore
          finalPayload.blocks.push({ type: "divider" });
        }

        // Add View Button - REMOVED per user request
        // const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.CONVEX_SITE_URL || 'http://localhost:3000';
        // @ts-ignore
        // finalPayload.blocks.push({
        //   type: "actions",
        //   elements: [
        //     {
        //       type: "button",
        //       text: {
        //         type: "plain_text",
        //         text: "Voir les changements",
        //         emoji: true
        //       },
        //       url: appUrl,
        //       style: "primary"
        //     }
        //   ]
        // });
      }

      // Check if the webhook URL is localhost or a private network
      const isLocalhost = args.webhookUrl.includes('localhost') ||
        args.webhookUrl.includes('127.0.0.1') ||
        args.webhookUrl.includes('0.0.0.0') ||
        args.webhookUrl.includes('192.168.') ||
        args.webhookUrl.includes('10.') ||
        args.webhookUrl.includes('172.');

      if (isLocalhost) {
        // Use the webhook proxy for localhost/private network URLs
        const proxyUrl = `${process.env.CONVEX_SITE_URL}/api/webhook-proxy`;
        console.log(`Using webhook proxy for localhost URL: ${proxyUrl}`);

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUrl: args.webhookUrl,
            payload: finalPayload,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Webhook proxy failed: ${response.status} ${errorData}`);
          throw new Error(`Webhook proxy failed with status ${response.status}`);
        }

        const responseData = await response.json();
        console.log(`Webhook sent successfully via proxy:`, responseData);

        return { success: responseData.success, status: responseData.status };
      } else {
        // Direct request for public URLs
        const response = await fetch(args.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Kabuki-Observer/1.0',
          },
          body: JSON.stringify(finalPayload),
        });

        if (!response.ok) {
          const errorDetails = await response.text();
          console.error(`Webhook failed with status ${response.status}: ${errorDetails}`);
          throw new Error(`Webhook failed with status ${response.status}: ${errorDetails}`);
        }

        const responseData = await response.text();
        console.log(`Webhook sent successfully: ${responseData}`);

        return { success: true, status: response.status };
      }
    } catch (error) {
      console.error("Failed to send webhook:", error);
      throw error;
    }
  },
});

export const sendEmailNotification = internalAction({
  args: {
    email: v.string(),
    websiteName: v.string(),
    websiteUrl: v.string(),
    changeType: v.string(),
    changeStatus: v.string(),
    diff: v.optional(v.object({
      text: v.string(),
      json: v.any(),
    })),
    title: v.optional(v.string()),
    scrapedAt: v.number(),
    userId: v.id("users"),
    aiAnalysis: v.optional(v.object({
      meaningfulChangeScore: v.number(),
      isMeaningfulChange: v.boolean(),
      reasoning: v.string(),
      analyzedAt: v.number(),
      model: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // Get user's custom email template
    const userSettings = await ctx.runQuery(internal.userSettings.getUserSettingsInternal, {
      userId: args.userId,
    });

    let htmlContent = '';

    if (userSettings?.emailTemplate) {
      // Use custom template with variable replacements
      let processedTemplate = userSettings.emailTemplate
        .replace(/{{websiteName}}/g, args.websiteName)
        .replace(/{{websiteUrl}}/g, args.websiteUrl)
        .replace(/{{changeDate}}/g, new Date(args.scrapedAt).toLocaleString())
        .replace(/{{changeType}}/g, args.changeStatus)
        .replace(/{{pageTitle}}/g, args.title || 'N/A')
        .replace(/{{viewChangesUrl}}/g, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
        .replace(/{{aiMeaningfulScore}}/g, args.aiAnalysis?.meaningfulChangeScore?.toString() || 'N/A')
        .replace(/{{aiIsMeaningful}}/g, args.aiAnalysis?.isMeaningfulChange ? 'Yes' : 'No')
        .replace(/{{aiReasoning}}/g, (args.aiAnalysis?.reasoning || 'N/A').replace(/<([^|]+)\|([^>]+)>/g, '<a href="$1">$2</a>'))
        .replace(/{{aiModel}}/g, args.aiAnalysis?.model || 'N/A')
        .replace(/{{aiAnalyzedAt}}/g, args.aiAnalysis?.analyzedAt ? new Date(args.aiAnalysis.analyzedAt).toLocaleString() : 'N/A');

      // Sanitize the HTML to prevent XSS
      htmlContent = sanitizeHtml(processedTemplate);
    } else {
      // Use default template
      htmlContent = `
        <h2>Website Change Alert</h2>
        <p>We've detected changes on the website you're monitoring:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3>${args.websiteName}</h3>
          <p><a href="${args.websiteUrl}">${args.websiteUrl}</a></p>
          <p><strong>Changed at:</strong> ${new Date(args.scrapedAt).toLocaleString()}</p>
          ${args.title ? `<p><strong>Page Title:</strong> ${args.title}</p>` : ''}
          ${args.aiAnalysis ? `
            <div style="background: #e8f4f8; border-left: 4px solid #2196F3; padding: 12px; margin: 15px 0;">
              <h4 style="margin: 0 0 8px 0; color: #1976D2;">AI Analysis</h4>
              <p><strong>Meaningful Change:</strong> ${args.aiAnalysis.isMeaningfulChange ? 'Yes' : 'No'} (${args.aiAnalysis.meaningfulChangeScore}% score)</p>
              <p><strong>Reasoning:</strong> ${args.aiAnalysis.reasoning.replace(/<([^|]+)\|([^>]+)>/g, '<a href="$1">$2</a>')}</p>
              <p style="font-size: 12px; color: #666; margin: 8px 0 0 0;">Analyzed by ${args.aiAnalysis.model} at ${new Date(args.aiAnalysis.analyzedAt).toLocaleString()}</p>
            </div>
          ` : ''}
        </div>
        <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}" style="background: #ff6600; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Changes</a></p>
      `;
    }

    await resend.sendEmail(ctx, {
      from: `${process.env.APP_NAME || 'Kabuki Observer'} <${process.env.FROM_EMAIL || 'noreply@example.com'}>`,
      to: args.email,
      subject: `Changes detected on ${args.websiteName}`,
      html: htmlContent,
    });
  },
});

export const sendCrawlWebhook = internalAction({
  args: {
    webhookUrl: v.string(),
    websiteId: v.id("websites"),
    websiteName: v.string(),
    websiteUrl: v.string(),
    sessionId: v.id("crawlSessions"),
    pagesFound: v.number(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; status: number } | undefined> => {
    // Get crawl session details
    const session = await ctx.runQuery(internal.crawl.getCrawlSession, {
      sessionId: args.sessionId,
    });

    if (!session) return;

    const payload = {
      event: "crawl_completed",
      timestamp: new Date().toISOString(),
      website: {
        id: args.websiteId,
        name: args.websiteName,
        url: args.websiteUrl,
        type: "full_site",
      },
      crawlSummary: {
        sessionId: args.sessionId,
        startedAt: new Date(session.startedAt).toISOString(),
        completedAt: session.completedAt ? new Date(session.completedAt).toISOString() : null,
        pagesFound: args.pagesFound,
        duration: session.completedAt ? `${Math.round((session.completedAt - session.startedAt) / 1000)}s` : null,
      },
      // Individual page changes are now tracked separately via change alerts
      note: "Individual page changes trigger separate notifications with detailed diffs",
    };

    try {
      console.log(`Sending crawl webhook to ${args.webhookUrl}`);

      // Check if it's a Slack webhook
      const isSlack = args.webhookUrl.includes('hooks.slack.com');
      let finalPayload: any = payload;

      if (isSlack) {
        console.log("Detected Slack webhook URL. Formatting crawl payload for Slack.");
        
        // Format for Slack Block Kit
        const summaryText = `Completed in ${payload.crawlSummary.duration}. Found ${args.pagesFound} pages.`;
        
        finalPayload = {
          // @ts-ignore
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `🕷️ Crawl Completed: ${args.websiteName}`,
                emoji: true
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Website:*\n<${args.websiteUrl}|${args.websiteName}>`
                },
                {
                  type: "mrkdwn",
                  text: `*Pages Found:*\n${args.pagesFound}`
                }
              ]
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Session Info:*\n${summaryText}`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "Individual page changes will be sent as separate notifications."
                }
              ]
            },
            {
              type: "divider"
            }
          ]
        };
      }

      // Check if the webhook URL is localhost or a private network
      const isLocalhost = args.webhookUrl.includes('localhost') ||
        args.webhookUrl.includes('127.0.0.1') ||
        args.webhookUrl.includes('0.0.0.0') ||
        args.webhookUrl.includes('192.168.') ||
        args.webhookUrl.includes('10.') ||
        args.webhookUrl.includes('172.');

      if (isLocalhost) {
        // Use the webhook proxy for localhost/private network URLs
        const proxyUrl = `${process.env.CONVEX_SITE_URL}/api/webhook-proxy`;
        console.log(`Using webhook proxy for localhost URL: ${proxyUrl}`);

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUrl: args.webhookUrl,
            payload: finalPayload,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Crawl webhook proxy failed: ${response.status} ${errorData}`);
          throw new Error(`Webhook proxy failed with status ${response.status}`);
        }

        const responseData = await response.json();
        console.log(`Crawl webhook sent successfully via proxy:`, responseData);

        return { success: responseData.success, status: responseData.status };
      } else {
        // Direct request for public URLs
        const response = await fetch(args.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Kabuki-Observer/1.0',
          },
          body: JSON.stringify(finalPayload),
        });

        if (!response.ok) {
          console.error(`Crawl webhook failed: ${response.status} ${response.statusText}`);
          throw new Error(`Webhook failed with status ${response.status}`);
        }

        console.log(`Crawl webhook sent successfully`);
        return { success: true, status: response.status };
      }
    } catch (error) {
      console.error("Failed to send crawl webhook:", error);
      throw error;
    }
  },
});