import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import FirecrawlApp from "@mendable/firecrawl-js";
import { requireCurrentUserForAction } from "./helpers";

// Initialize Firecrawl client with user's API key
// Custom Firecrawl client for self-hosted instances (v0 support)
class CustomFirecrawlApp {
  private apiKey: string;
  private apiUrl: string;

  constructor({ apiKey, apiUrl }: { apiKey: string; apiUrl: string }) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl.replace(/\/$/, "");
  }

  async scrapeUrl(url: string, params: any) {
    // Use v1 endpoint (confirmed working by user)
    const endpoint = `${this.apiUrl}/v1/scrape`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": this.apiKey, // Self-hosted often uses this
        },
        body: JSON.stringify({ url, ...params }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async crawlUrl(url: string, params: any) {
    const endpoint = `${this.apiUrl}/v1/crawl`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": this.apiKey,
        },
        body: JSON.stringify({ url, ...params }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async checkCrawlStatus(jobId: string) {
    const endpoint = `${this.apiUrl}/v1/crawl/${jobId}`;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, status: "error", error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error: any) {
      return { success: false, status: "error", error: error.message };
    }
  }
}

export const getFirecrawlClient = async (ctx: any, userId: string): Promise<{ client: any, instanceType: string }> => {
  // First try to get user's API key from internal query
  const userKeyData: any = await ctx.runQuery(internal.firecrawlKeys.getDecryptedFirecrawlKey, { userId });
  const envApiUrl = process.env.FIRECRAWL_API_URL;

  if (userKeyData && userKeyData.key) {
    // Using user's Firecrawl API key
    // Update last used timestamp
    await ctx.runMutation(internal.firecrawlKeys.updateLastUsed, { keyId: userKeyData.keyId });

    const instanceType = userKeyData.instanceType || "cloud";
    const userApiUrl = userKeyData.apiUrl;

    // Use user's self-hosted instance if configured
    if (instanceType === "self-hosted" && userApiUrl) {
      return { client: new CustomFirecrawlApp({ apiKey: userKeyData.key, apiUrl: userApiUrl }), instanceType };
    }

    // If user explicitly selected cloud, use cloud app (ignore envApiUrl)
    if (instanceType === "cloud") {
      return { client: new FirecrawlApp({ apiKey: userKeyData.key }), instanceType };
    }

    // Use environment self-hosted instance if configured (fallback)
    if (envApiUrl) {
      return { client: new CustomFirecrawlApp({ apiKey: userKeyData.key, apiUrl: envApiUrl }), instanceType: "self-hosted" };
    }

    // Default to cloud
    return { client: new FirecrawlApp({ apiKey: userKeyData.key }), instanceType: "cloud" };
  }

  // Fallback to environment variable if user hasn't set their own key
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("No Firecrawl API key found in environment or user settings");
    throw new Error("No Firecrawl API key found. Please add your API key in settings.");
  }

  // Using environment Firecrawl API key
  if (envApiUrl) {
    return { client: new CustomFirecrawlApp({ apiKey, apiUrl: envApiUrl }), instanceType: "self-hosted" };
  }
  return { client: new FirecrawlApp({ apiKey }), instanceType: "cloud" };
};

// Scrape a URL and track changes
export const scrapeUrl = internalAction({
  args: {
    websiteId: v.id("websites"),
    url: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx: any, args: any): Promise<{
    success: boolean;
    scrapeResultId: Id<"scrapeResults">;
    changeStatus: string | undefined;
    visibility: string | undefined;
    previousScrapeAt: string | undefined;
  }> => {
    const { client: firecrawl, instanceType } = await getFirecrawlClient(ctx, args.userId);

    // Get website details to check for headers
    const website = await ctx.runQuery(internal.websites.getWebsite, {
      websiteId: args.websiteId,
      userId: args.userId,
    });

    let scrapeOptions: any = {
      formats: ["markdown", "links", "changeTracking"],
      timeout: 120000,
      changeTrackingOptions: {
        modes: ["git-diff"], // Enable git-diff to see what changed
      }
    };

    // Add headers if configured
    if (website?.headers) {
      try {
        const headers = JSON.parse(website.headers);
        scrapeOptions.headers = headers;
      } catch (e) {
        console.error("Failed to parse website headers:", e);
      }
    }

    try {
      // Scraping URL with change tracking
      // Scrape with change tracking - markdown is required for changeTracking
      const result = await firecrawl.scrapeUrl(args.url, scrapeOptions) as any;

      if (!result.success) {
        throw new Error(`Firecrawl scrape failed: ${result.error}`);
      }

      // Log only essential info, not the full response

      // Firecrawl returns markdown directly on the result object
      const markdown = result?.markdown || "";
      const changeTracking = result?.changeTracking;
      const metadata = result?.metadata;
      const links = result?.links || [];

      // Log only essential change status
      if (changeTracking?.changeStatus === "changed") {
        console.log(`Change detected for ${args.url}: ${changeTracking.changeStatus}`);
      }

      // Store the scrape result
      const scrapeResultId = await ctx.runMutation(internal.websites.storeScrapeResult, {
        websiteId: args.websiteId,
        userId: args.userId,
        markdown: markdown,
        changeStatus: changeTracking?.changeStatus || "new",
        visibility: changeTracking?.visibility || "visible",
        previousScrapeAt: changeTracking?.previousScrapeAt
          ? new Date(changeTracking.previousScrapeAt).getTime()
          : undefined,
        scrapedAt: Date.now(),
        firecrawlMetadata: metadata,
        ogImage: metadata?.ogImage || undefined,
        title: metadata?.title || undefined,
        description: metadata?.description || undefined,
        url: args.url, // Pass the actual URL that was scraped
        diff: changeTracking?.diff ? {
          text: changeTracking.diff.text || "",
          json: changeTracking.diff.json || null,
        } : undefined,
      }) as Id<"scrapeResults">;

      // If content changed, create an alert and send notifications
      if (changeTracking?.changeStatus === "changed" || changeTracking?.diff) {
        const diffPreview = changeTracking?.diff?.text ?
          changeTracking.diff.text.substring(0, 200) + (changeTracking.diff.text.length > 200 ? "..." : "") :
          "Website content has changed since last check";

        await ctx.runMutation(internal.websites.createChangeAlert, {
          websiteId: args.websiteId,
          userId: args.userId,
          scrapeResultId,
          changeType: "content_changed",
          summary: diffPreview,
        });

        // Trigger AI analysis if enabled and there's a diff
        if (changeTracking?.diff) {
          await ctx.scheduler.runAfter(0, internal.aiAnalysis.analyzeChange, {
            userId: args.userId,
            scrapeResultId,
            websiteName: metadata?.title || args.url,
            websiteUrl: args.url,
            diff: changeTracking.diff,
            links: links, // Pass the links found on the page
          });
        }

        // Get user settings to check if AI analysis is enabled
        const userSettings = await ctx.runQuery(internal.userSettings.getUserSettingsInternal, {
          userId: args.userId,
        });

        // If AI analysis is NOT enabled, send notifications immediately
        if (!userSettings?.aiAnalysisEnabled || !changeTracking?.diff) {
          // Get website details for notifications
          const website = await ctx.runQuery(internal.websites.getWebsite, {
            websiteId: args.websiteId,
            userId: args.userId,
          });

          if (website && website.notificationPreference !== "none") {
            // Resolve webhook URL (fallback to default if not set on website)
            const resolvedWebhookUrl = website.webhookUrl || userSettings?.defaultWebhookUrl;

            // Send webhook notification
            if ((website.notificationPreference === "webhook" || website.notificationPreference === "both") && resolvedWebhookUrl) {
              await ctx.scheduler.runAfter(0, internal.notifications.sendWebhookNotification, {
                webhookUrl: resolvedWebhookUrl,
                websiteId: args.websiteId,
                websiteName: website.name,
                websiteUrl: args.url, // Use the actual page URL, not the root website URL
                scrapeResultId,
                changeType: "content_changed",
                changeStatus: changeTracking.changeStatus,
                diff: changeTracking?.diff,
                title: metadata?.title,
                description: metadata?.description,
                markdown: markdown,
                scrapedAt: Date.now(),
              });
            }

            // Send email notification
            if (website.notificationPreference === "email" || website.notificationPreference === "both") {
              // Get user's email configuration
              const emailConfig = await ctx.runQuery(internal.emailManager.getEmailConfigInternal, {
                userId: args.userId,
              });

              if (emailConfig?.email && emailConfig.isVerified) {
                await ctx.scheduler.runAfter(0, internal.notifications.sendEmailNotification, {
                  email: emailConfig.email,
                  websiteName: website.name,
                  websiteUrl: args.url,
                  changeType: "content_changed",
                  changeStatus: changeTracking.changeStatus,
                  diff: changeTracking?.diff,
                  title: metadata?.title,
                  scrapedAt: Date.now(),
                  userId: args.userId,
                });
              }
            }
          }
        }
        // If AI analysis IS enabled, notifications will be handled by the AI analysis callback
      }

      return {
        success: true,
        scrapeResultId,
        changeStatus: changeTracking?.changeStatus,
        visibility: changeTracking?.visibility,
        previousScrapeAt: changeTracking?.previousScrapeAt,
      };
    } catch (error: any) {
      console.error("Firecrawl scrape error:", error);
      throw error;
    }
  },
});

// Scrape a URL just for analysis (no side effects in DB)
export const scrapeUrlForAnalysis = internalAction({
  args: {
    url: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx: any, args: any) => {
    const { client: firecrawl } = await getFirecrawlClient(ctx, args.userId);
    try {
      const result = await firecrawl.scrapeUrl(args.url, {
        formats: ["markdown"],
        timeout: 120000,
      }) as any;

      if (!result.success) {
        console.error(`Failed to scrape ${args.url}: ${result.error}`);
        return null;
      }

      return result.markdown;
    } catch (error) {
      console.error(`Error scraping ${args.url}:`, error);
      return null;
    }
  },
});

// Public action to initiate a manual scrape
export const triggerScrape = action({
  args: {
    websiteId: v.id("websites"),
  },
  handler: async (ctx: any, args: any) => {
    const userId = await requireCurrentUserForAction(ctx);

    // Get website details
    const website = await ctx.runQuery(internal.websites.getWebsite, {
      websiteId: args.websiteId,
      userId: userId,
    });

    if (!website) {
      throw new Error("Website not found");
    }

    // Create immediate checking status entry
    await ctx.runMutation(internal.websites.createCheckingStatus, {
      websiteId: args.websiteId,
      userId: userId,
    });

    // Update lastChecked immediately to prevent duplicate checks
    await ctx.runMutation(internal.websites.updateLastChecked, {
      websiteId: args.websiteId,
    });

    // Trigger the appropriate check based on monitor type
    if (website.monitorType === "full_site") {
      // For full site, perform a crawl
      await ctx.scheduler.runAfter(0, internal.crawl.performCrawl, {
        websiteId: args.websiteId,
        userId: userId,
      });
    } else {
      // For single page, just scrape the URL
      await ctx.scheduler.runAfter(0, internal.firecrawl.scrapeUrl, {
        websiteId: args.websiteId,
        url: website.url,
        userId: userId,
      });
    }

    return { success: true };
  },
});

// Crawl an entire website (for initial setup or full refresh)
export const crawlWebsite = action({
  args: {
    url: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const userId = await requireCurrentUserForAction(ctx);

    const { client: firecrawl } = await getFirecrawlClient(ctx, userId);

    try {
      const crawlResult = await firecrawl.crawlUrl(args.url, {
        limit: args.limit || 10,
        scrapeOptions: {
          formats: ["markdown", "changeTracking"],
          timeout: 120000,
        },
      }) as any;

      if (!crawlResult.success) {
        throw new Error(`Firecrawl crawl failed: ${crawlResult.error}`);
      }

      return {
        success: true,
        totalPages: crawlResult.data?.length || 0,
        pages: crawlResult.data?.map((page: any) => ({
          url: page.url,
          title: page.metadata?.title,
          changeStatus: page.changeTracking?.changeStatus,
          visibility: page.changeTracking?.visibility,
        })),
      };
    } catch (error) {
      console.error("Firecrawl crawl error:", error);
      throw error;
    }
  },
});

// Scrape a URL to get all links (for fallback link discovery)
export const scrapePageLinks = internalAction({
  args: {
    url: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    const { client: firecrawl } = await getFirecrawlClient(ctx, args.userId);

    try {
      const response: any = await firecrawl.scrapeUrl(args.url, {
        formats: ["links"],
        timeout: 120000,
      });

      if (!response.success) {
        throw new Error(`Firecrawl link scrape failed: ${response.error}`);
      }

      return response.links || [];
    } catch (error) {
      console.error("Error scraping links:", error);
      return [];
    }
  },
});