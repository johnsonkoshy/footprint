import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * The cache. Extraction plus research costs about 17 cents and two minutes per
 * company; pasting the same URL twice should cost neither. Writes happen from
 * the browser as each stage lands, so a run that is interrupted halfway still
 * leaves everything it had finished.
 */

/** Same normalisation on both sides, or the cache silently never hits. */
export function normalise(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return trimmed;
  }
}

export const get = query({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<Doc<"brands"> | null> => {
    if (!url.trim()) return null;
    return await ctx.db
      .query("brands")
      .withIndex("by_url", (q) => q.eq("url", normalise(url)))
      .unique();
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("brands").order("desc").take(limit ?? 12);
    // Trim to what a gallery needs: whole rows carry a 160KB screenshot each.
    return rows
      .filter((r) => r.status === "ready" && r.kit)
      .map((r) => ({
        url: r.url,
        name: r.kit?.name ?? r.url,
        primary: r.kit?.palette?.primary ?? null,
        logo: r.kit?.logo?.dataUri ?? null,
        updatedAt: r.updatedAt,
      }));
  },
});

/** Called the moment a run starts, so a second tab sees it working. */
export const start = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const key = normalise(url);
    const existing = await ctx.db
      .query("brands")
      .withIndex("by_url", (q) => q.eq("url", key))
      .unique();
    const patch = { status: "working" as const, stage: "screenshotting", error: undefined, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("brands", { url: key, ...patch });
  },
});

/**
 * One writer for every stage. Each stage calls it with only the fields it just
 * produced, so a partial run is still a useful cache entry.
 */
export const save = mutation({
  args: {
    url: v.string(),
    stage: v.optional(v.string()),
    status: v.optional(v.union(v.literal("working"), v.literal("ready"), v.literal("failed"))),
    error: v.optional(v.string()),
    kit: v.optional(v.any()),
    signals: v.optional(v.any()),
    text: v.optional(v.string()),
    audience: v.optional(v.any()),
    competitors: v.optional(v.any()),
    plan: v.optional(v.any()),
    addCents: v.optional(v.number()),
  },
  handler: async (ctx, { url, addCents, ...fields }) => {
    const key = normalise(url);
    const existing = await ctx.db
      .query("brands")
      .withIndex("by_url", (q) => q.eq("url", key))
      .unique();

    // undefined means "this stage had nothing to say", not "erase it".
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, value] of Object.entries(fields)) {
      if (value !== undefined) patch[k] = value;
    }
    if (addCents) patch.cents = (existing?.cents ?? 0) + addCents;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("brands", {
      url: key,
      status: "working",
      ...patch,
    } as Parameters<typeof ctx.db.insert<"brands">>[1]);
  },
});

export const savePost = mutation({
  args: {
    url: v.string(),
    topic: v.string(),
    channel: v.optional(v.string()),
    format: v.optional(v.string()),
    content: v.any(),
    template: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("posts", {
      ...args,
      url: normalise(args.url),
      createdAt: Date.now(),
    });
  },
});

export const posts = query({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    return await ctx.db
      .query("posts")
      .withIndex("by_url", (q) => q.eq("url", normalise(url)))
      .order("desc")
      .take(20);
  },
});

/** Escape hatch for a stale or wrong cache entry, and for demoing a cold run. */
export const forget = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const row = await ctx.db
      .query("brands")
      .withIndex("by_url", (q) => q.eq("url", normalise(url)))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});
