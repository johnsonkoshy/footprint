import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * One row per company, keyed by normalised URL. The URL is the identity -
 * there is no auth in this product by design, so there is nothing else to key
 * on and nothing user-specific to protect.
 *
 * The research fields are stored as `v.any()` on purpose. Every one of them is
 * already validated by a zod schema at the API boundary before it gets here,
 * and mirroring those shapes in Convex validators would be a second copy of
 * the contract to keep in sync for no extra safety.
 */
export default defineSchema({
  brands: defineTable({
    /** Normalised: lowercase host, no protocol, no trailing slash. */
    url: v.string(),
    /** What the pipeline is doing, so a second tab can watch the first one work. */
    status: v.union(v.literal("working"), v.literal("ready"), v.literal("failed")),
    stage: v.optional(v.string()),
    error: v.optional(v.string()),

    kit: v.optional(v.any()),
    signals: v.optional(v.any()),
    /** Homepage copy. The market stage reads the buyer out of this. */
    text: v.optional(v.string()),
    /*
     * No screenshot here on purpose. A stripe.com capture is 828KB as a data
     * URI, which is most of Convex's 1MB document cap for a field the cache-hit
     * path never renders - a hit skips straight past "reading it now". Dropping
     * it takes the row from ~850KB to ~25KB.
     */
    audience: v.optional(v.any()),
    competitors: v.optional(v.any()),
    plan: v.optional(v.any()),

    /** What each stage cost, so the cache can show what it saved. */
    cents: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_url", ["url"]),

  /** Generated posts, kept so a brand accumulates a library rather than one post. */
  posts: defineTable({
    url: v.string(),
    topic: v.string(),
    channel: v.optional(v.string()),
    format: v.optional(v.string()),
    content: v.any(),
    template: v.string(),
    createdAt: v.number(),
  }).index("by_url", ["url"]),
});
