import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const brandKit = v.object({
  name: v.string(),
  tagline: v.string(),
  palette: v.object({
    primary: v.string(),
    ink: v.string(),
    surface: v.string(),
    accent: v.string(),
  }),
  typography: v.object({ display: v.string(), body: v.string() }),
  geometry: v.object({ radius: v.number() }),
  logoUrl: v.union(v.string(), v.null()),
  imagery: v.object({ style: v.string() }),
  voice: v.object({
    tone: v.string(),
    sample: v.string(),
    avoid: v.array(v.string()),
  }),
});

const contentSet = v.object({
  hook: v.string(),
  caption: v.string(),
  slides: v.array(v.string()),
  hashtags: v.array(v.string()),
});

export default defineSchema({
  // The URL is the identity (hard rule 3). No users table, ever.
  kits: defineTable({
    url: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    stage: v.optional(v.string()), // "screenshotting" | "reading" | "analyzing"
    error: v.optional(v.string()),
    kit: v.optional(brandKit),
  }).index("by_url", ["url"]),

  posts: defineTable({
    kitId: v.id("kits"),
    topic: v.string(),
    content: contentSet,
  }).index("by_kit", ["kitId"]),
});
