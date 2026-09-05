import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, { url }) =>
    ctx.db
      .query("kits")
      .withIndex("by_url", (q) => q.eq("url", url))
      .unique(),
});

export const get = query({
  args: { id: v.id("kits") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const start = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const existing = await ctx.db
      .query("kits")
      .withIndex("by_url", (q) => q.eq("url", url))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        stage: "screenshotting",
        error: undefined,
      });
      return existing._id;
    }
    return ctx.db.insert("kits", {
      url,
      status: "pending",
      stage: "screenshotting",
    });
  },
});

export const setStage = mutation({
  args: { id: v.id("kits"), stage: v.string() },
  handler: async (ctx, { id, stage }) => ctx.db.patch(id, { stage }),
});
