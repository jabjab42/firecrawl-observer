import { v } from "convex/values";
import { mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { modifyAccountCredentials } from "@convex-dev/auth/server";

export const requestPasswordReset = mutation({
    args: {
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", args.email))
            .first();

        if (!user) {
            // Don't reveal if user exists
            return { success: true };
        }

        const token = Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
        const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

        await ctx.db.insert("passwordResets", {
            email: args.email,
            token,
            expiry,
            createdAt: Date.now(),
        });

        await ctx.scheduler.runAfter(0, internal.emailManager.sendPasswordResetEmail, {
            email: args.email,
            token,
        });

        return { success: true };
    },
});

export const verifyToken = internalQuery({
    args: {
        token: v.string(),
    },
    handler: async (ctx, args) => {
        const reset = await ctx.db
            .query("passwordResets")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!reset) {
            return null;
        }

        if (reset.expiry < Date.now()) {
            return null;
        }

        return reset;
    },
});

export const consumeToken = internalMutation({
    args: {
        token: v.string(),
    },
    handler: async (ctx, args) => {
        const reset = await ctx.db
            .query("passwordResets")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (reset) {
            await ctx.db.delete(reset._id);
        }
    },
});

export const resetPassword = action({
    args: {
        token: v.string(),
        newPassword: v.string(),
    },
    handler: async (ctx, args) => {
        const reset = await ctx.runQuery(internal.passwordReset.verifyToken, {
            token: args.token,
        });

        if (!reset) {
            throw new Error("Invalid or expired token");
        }

        await modifyAccountCredentials(ctx, {
            provider: "password",
            account: {
                id: reset.email,
                secret: args.newPassword,
            },
        });

        await ctx.runMutation(internal.passwordReset.consumeToken, {
            token: args.token,
        });

        return { success: true };
    },
});
