import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// API endpoint to create websites
http.route({
  path: "/api/create-websites",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.substring(7);

    // Validate API key and get user
    const user = await ctx.runMutation(internal.apiKeys.validateApiKeyAndGetUser, { apiKey: token });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const body = await request.json();
      const isBatch = Array.isArray(body);

      if (isBatch) {
        const results = [];
        const errors = [];

        for (let i = 0; i < body.length; i++) {
          const website = body[i];

          if (!website.url) {
            errors.push({
              index: i,
              url: website.url || "not provided",
              error: "Missing required field: url"
            });
            continue;
          }

          try {
            // Process the URL
            let processedUrl = website.url.trim();
            if (!processedUrl.match(/^https?:\/\//)) {
              processedUrl = "https://" + processedUrl;
            }

            // Validate URL
            let hostname = "";
            try {
              const urlObj = new URL(processedUrl);
              hostname = urlObj.hostname.replace("www.", "");
            } catch {
              throw new Error(`Invalid URL format: ${website.url}`);
            }

            // Set defaults
            const monitorType = website.type === "crawl" ? "full_site" : "single_page";
            const checkInterval = website.checkInterval || 60;
            const notificationPreference = website.webhook ? "webhook" : "none";
            const crawlLimit = website.crawlLimit || 5;
            const crawlDepth = website.crawlDepth || 3;
            const name = website.name || hostname.charAt(0).toUpperCase() + hostname.slice(1);

            // Create the website
            const websiteId = await ctx.runMutation(internal.websites.createWebsiteFromApi, {
              userId: user._id,
              url: processedUrl,
              name: name,
              checkInterval: checkInterval,
              notificationPreference: notificationPreference,
              webhookUrl: website.webhook || undefined,
              monitorType: monitorType,
              crawlLimit: monitorType === "full_site" ? crawlLimit : undefined,
              crawlDepth: monitorType === "full_site" ? crawlDepth : undefined,
            });

            results.push({
              index: i,
              websiteId: websiteId,
              url: processedUrl,
              name: name,
              type: monitorType,
              checkInterval: checkInterval,
              webhook: website.webhook || null,
            });
          } catch (error: any) {
            errors.push({
              index: i,
              url: website.url,
              error: error.message
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Batch request processed. ${results.length} websites added successfully.`,
            results: results,
            errors: errors.length > 0 ? errors : undefined,
            total: body.length,
            successful: results.length,
            failed: errors.length
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Single website request
        if (!body.url) {
          return new Response(
            JSON.stringify({ error: "Missing required field: url" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Process the URL
        let processedUrl = body.url.trim();
        if (!processedUrl.match(/^https?:\/\//)) {
          processedUrl = "https://" + processedUrl;
        }

        // Validate URL
        let hostname = "";
        try {
          const urlObj = new URL(processedUrl);
          hostname = urlObj.hostname.replace("www.", "");
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid URL format" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Set defaults
        const monitorType = body.type === "crawl" ? "full_site" : "single_page";
        const checkInterval = body.checkInterval || 60;
        const notificationPreference = body.webhook ? "webhook" : "none";
        const crawlLimit = body.crawlLimit || 5;
        const crawlDepth = body.crawlDepth || 3;
        const name = body.name || hostname.charAt(0).toUpperCase() + hostname.slice(1);

        // Create the website
        const websiteId = await ctx.runMutation(internal.websites.createWebsiteFromApi, {
          userId: user._id,
          url: processedUrl,
          name: name,
          checkInterval: checkInterval,
          notificationPreference: notificationPreference,
          webhookUrl: body.webhook || undefined,
          monitorType: monitorType,
          crawlLimit: monitorType === "full_site" ? crawlLimit : undefined,
          crawlDepth: monitorType === "full_site" ? crawlDepth : undefined,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "Website added successfully",
            websiteId: websiteId,
            data: {
              url: processedUrl,
              name: name,
              type: monitorType,
              checkInterval: checkInterval,
              webhook: body.webhook || null,
              crawlLimit: monitorType === "full_site" ? crawlLimit : null,
              crawlDepth: monitorType === "full_site" ? crawlDepth : null,
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (error: any) {
      console.error("API error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error", details: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Webhook proxy endpoint
http.route({
  path: "/api/webhook-proxy",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { targetUrl, payload } = body;

      if (!targetUrl || !payload) {
        return new Response(
          JSON.stringify({ error: "Missing targetUrl or payload" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Make the webhook request from the HTTP action
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kabuki-Observer/1.0',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      return new Response(
        JSON.stringify({
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          response: responseText,
        }),
        {
          status: response.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error: any) {
      console.error("Webhook proxy error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to proxy webhook", details: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// API endpoint to pause/resume websites
http.route({
  path: "/api/pause-websites",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.substring(7);

    // Validate API key and get user
    const user = await ctx.runMutation(internal.apiKeys.validateApiKeyAndGetUser, { apiKey: token });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const body = await request.json();

      if (!body.websiteId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: websiteId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const isPaused = body.paused === true;

      // Update the website pause status
      const result = await ctx.runMutation(internal.websites.pauseWebsiteFromApi, {
        userId: user._id,
        websiteId: body.websiteId,
        isPaused: isPaused
      });

      if (!result) {
        return new Response(
          JSON.stringify({ error: "Website not found or access denied" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Website ${isPaused ? 'paused' : 'resumed'} successfully`,
          websiteId: body.websiteId,
          isPaused: isPaused
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("API error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error", details: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// API endpoint to delete websites
http.route({
  path: "/api/delete-websites",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.substring(7);

    // Validate API key and get user
    const user = await ctx.runMutation(internal.apiKeys.validateApiKeyAndGetUser, { apiKey: token });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const body = await request.json();

      if (!body.websiteId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: websiteId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Delete the website
      const result = await ctx.runMutation(internal.websites.deleteWebsiteFromApi, {
        userId: user._id,
        websiteId: body.websiteId
      });

      if (!result) {
        return new Response(
          JSON.stringify({ error: "Website not found or access denied" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Website deleted successfully",
          websiteId: body.websiteId
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("API error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error", details: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;