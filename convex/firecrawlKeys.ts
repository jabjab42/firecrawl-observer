import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation, action } from "./_generated/server";
import { requireCurrentUser, getCurrentUser } from "./helpers";
import FirecrawlApp from "@mendable/firecrawl-js";

// Simple obfuscation for API keys (in production, use proper encryption)
// TEMPORARY: Store in plain text to debug the issue
function encryptKey(key: string): string {
  // TODO: In production, use proper encryption with a secure key management service
  return key;
}

function decryptKey(encryptedKey: string): string {
  // TODO: In production, use proper decryption with a secure key management service
  return encryptedKey;
}

// Get the current user's Firecrawl API key
export const getUserFirecrawlKey = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const apiKey = await ctx.db
      .query("firecrawlApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!apiKey) {
      return null;
    }

    return {
      hasKey: true,
      instanceType: apiKey.instanceType || "cloud",
      apiUrl: apiKey.encryptedApiUrl ? decryptKey(apiKey.encryptedApiUrl) : undefined,
      lastUsed: apiKey.lastUsed,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
      // Don't return the actual key for security
      maskedKey: decryptKey(apiKey.encryptedKey).slice(0, 8) + '...' + decryptKey(apiKey.encryptedKey).slice(-4),
    };
  },
});

// Set or update the Firecrawl API key
export const setFirecrawlKey = mutation({
  args: {
    apiKey: v.string(),
    instanceType: v.optional(v.union(v.literal("cloud"), v.literal("self-hosted"))),
    apiUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    // Validate the API key format
    const trimmedKey = args.apiKey.trim();
    if (!trimmedKey || trimmedKey.length < 20) {
      throw new Error("Invalid API key format");
    }

    const instanceType = args.instanceType || "cloud";

    // Firecrawl cloud keys typically start with 'fc-', but self-hosted may use different formats
    if (instanceType === "cloud" && !trimmedKey.startsWith('fc-')) {
      throw new Error("Invalid Firecrawl API key format. Cloud keys should start with 'fc-'");
    }

    // Validate API URL for self-hosted instances
    if (instanceType === "self-hosted" && !args.apiUrl) {
      throw new Error("API URL is required for self-hosted instances");
    }

    // Check if user already has a key
    const existingKey = await ctx.db
      .query("firecrawlApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const encryptedKey = encryptKey(trimmedKey);
    const encryptedApiUrl = args.apiUrl ? encryptKey(args.apiUrl) : undefined;
    const now = Date.now();

    // Debug: verify encryption/decryption works
    const testDecrypt = decryptKey(encryptedKey);
    if (testDecrypt !== trimmedKey) {
      console.error("Encryption/decryption mismatch:", {
        original: trimmedKey.slice(0, 8) + "...",
        decrypted: testDecrypt.slice(0, 8) + "..."
      });
      throw new Error("Failed to encrypt API key properly");
    }

    if (existingKey) {
      // Update existing key
      await ctx.db.patch(existingKey._id, {
        encryptedKey,
        instanceType,
        encryptedApiUrl,
        updatedAt: now,
      });
    } else {
      // Create new key
      await ctx.db.insert("firecrawlApiKeys", {
        userId: user._id,
        encryptedKey,
        instanceType,
        encryptedApiUrl,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// Delete the Firecrawl API key
export const deleteFirecrawlKey = mutation({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);

    const apiKey = await ctx.db
      .query("firecrawlApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (apiKey) {
      await ctx.db.delete(apiKey._id);
    }

    return { success: true };
  },
});

// Internal query to get decrypted API key for backend use
export const getDecryptedFirecrawlKey = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("firecrawlApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!apiKey) {
      return null;
    }

    return {
      key: decryptKey(apiKey.encryptedKey),
      keyId: apiKey._id,
      instanceType: apiKey.instanceType || "cloud",
      apiUrl: apiKey.encryptedApiUrl ? decryptKey(apiKey.encryptedApiUrl) : undefined,
    };
  },
});

// Internal mutation to update last used timestamp
export const updateLastUsed = internalMutation({
  args: {
    keyId: v.id("firecrawlApiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, {
      lastUsed: Date.now(),
    });
  },
});

// Import internal for the action
import { internal } from "./_generated/api";
import { requireCurrentUserForAction } from "./helpers";

// Action to get token usage from Firecrawl API
export const getTokenUsage = action({
  handler: async (ctx): Promise<{ success: boolean; error?: string; remaining_tokens?: number }> => {
    const user = await requireCurrentUserForAction(ctx);

    // Get user's API key
    const keyData: any = await ctx.runQuery(internal.firecrawlKeys.getDecryptedFirecrawlKey, {
      userId: user
    });

    if (!keyData || !keyData.key) {
      return {
        success: false,
        error: "No API key found"
      };
    }

    try {
      const response: Response = await fetch('https://api.firecrawl.dev/v1/team/credit-usage', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${keyData.key}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        return {
          success: false,
          error: errorData.error || `API error: ${response.status}`
        };
      }

      const data: any = await response.json();
      return {
        success: true,
        remaining_tokens: data.data?.remaining_credits
      };
    } catch (error) {
      console.error("Failed to fetch token usage:", error);
      return {
        success: false,
        error: "Failed to fetch token usage"
      };
    }
  },
});