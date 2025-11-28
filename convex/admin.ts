import { v } from "convex/values";
import { mutation, query, action, internalAction, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUser } from "./helpers";

// Helper to check if the current user is an admin
async function requireAdmin(ctx: QueryCtx | MutationCtx) {
    const user = await getCurrentUser(ctx);
    if (!user) {
        throw new Error("Unauthorized");
    }

    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];

    console.log(`[Admin Check] User Email: ${user.email}`);
    console.log(`[Admin Check] Allowed Admins: ${JSON.stringify(adminEmails)}`);

    if (!user.email || !adminEmails.includes(user.email)) {
        throw new Error("Unauthorized: Admin access required");
    }

    return user;
}

// Get all users with basic stats
export const getAllUsers = query({
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const users = await ctx.db.query("users").collect();

        // Enrich with website counts (this might be slow for many users, but fine for now)
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const websites = await ctx.db
                .query("websites")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .collect();

            return {
                ...user,
                websiteCount: websites.length,
                activeWebsiteCount: websites.filter(w => w.isActive).length,
            };
        }));

        return usersWithStats;
    },
});

// Get full details for a specific user
export const getUserDetails = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) return null;

        const emailConfig = await ctx.db
            .query("emailConfig")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        const userSettings = await ctx.db
            .query("userSettings")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        const websites = await ctx.db
            .query("websites")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        return {
            user,
            emailConfig,
            userSettings,
            websites,
        };
    },
});

// Update user email configuration (Admin override)
export const updateUserEmailConfig = mutation({
    args: {
        userId: v.id("users"),
        email: v.string(),
        isVerified: v.boolean(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const existingConfig = await ctx.db
            .query("emailConfig")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        if (existingConfig) {
            await ctx.db.patch(existingConfig._id, {
                email: args.email,
                isVerified: args.isVerified,
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.insert("emailConfig", {
                userId: args.userId,
                email: args.email,
                isVerified: args.isVerified,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    },
});

// Update user settings (Admin override)
export const updateUserSettings = mutation({
    args: {
        userId: v.id("users"),
        settings: v.object({
            aiSystemPrompt: v.optional(v.string()),
            aiModel: v.optional(v.string()),
            goNoGoRules: v.optional(v.string()),
            emailOnlyIfMeaningful: v.optional(v.boolean()),
        }),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const existingSettings = await ctx.db
            .query("userSettings")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .first();

        if (existingSettings) {
            await ctx.db.patch(existingSettings._id, {
                ...args.settings,
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.insert("userSettings", {
                userId: args.userId,
                emailNotificationsEnabled: true, // Default
                ...args.settings,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    },
});
