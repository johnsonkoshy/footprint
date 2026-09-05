import type { BrandKit, ContentSet } from "@/types";

/**
 * Hand-written kits so rendering can be built and judged before extraction is
 * live. These are what we'd expect a good extraction to return - they are the
 * bar, not a substitute.
 */
export const FIXTURE_KITS: Record<string, BrandKit> = {
  stripe: {
    name: "Stripe",
    tagline: "Financial infrastructure to grow your revenue",
    palette: { primary: "#635BFF", ink: "#0A2540", surface: "#FFFFFF", accent: "#00D4FF" },
    typography: { display: "Sohne", body: "Sohne" },
    geometry: { radius: 8 },
    logoUrl: null,
    logo: null,
    imagery: { style: "gradient meshes and layered product UI, no stock photography" },
    voice: {
      tone: "precise, technical, quietly confident",
      sample: "Millions of companies of all sizes use Stripe online and in person to accept payments, send payouts, and manage their businesses.",
      avoid: ["exclamation marks", "revolutionise", "addressing the reader as 'folks'", "hype adjectives"],
    },
  },
  linear: {
    name: "Linear",
    tagline: "The system for modern software development",
    palette: { primary: "#5E6AD2", ink: "#08090A", surface: "#F7F8F8", accent: "#D2D3E0" },
    typography: { display: "Inter Display", body: "Inter" },
    geometry: { radius: 6 },
    logoUrl: null,
    logo: null,
    imagery: { style: "dark UI screenshots, subtle gradients, high-contrast minimal chrome" },
    voice: {
      tone: "terse, opinionated, engineer-to-engineer",
      sample: "Linear is a purpose-built tool for planning and building products.",
      avoid: ["marketing superlatives", "exclamation marks", "the word 'solution'", "long sentences"],
    },
  },
  notion: {
    name: "Notion",
    tagline: "The AI workspace that works for you",
    palette: { primary: "#191918", ink: "#191918", surface: "#FFFDFB", accent: "#D44C47" },
    typography: { display: "Lyon Display", body: "Inter" },
    geometry: { radius: 4 },
    logoUrl: null,
    logo: null,
    imagery: { style: "hand-drawn line illustration, warm off-white paper, product UI in soft shadow" },
    voice: {
      tone: "warm, plainspoken, faintly playful",
      sample: "Write, plan, and get organized in one place. Notion is the connected workspace where better, faster work happens.",
      avoid: ["enterprise jargon", "the word 'leverage'", "aggressive urgency", "shouting in all caps"],
    },
  },
  craigslist: {
    name: "craigslist",
    tagline: "local classifieds and forums",
    palette: { primary: "#551A8B", ink: "#000000", surface: "#FFFFFF", accent: "#0000EE" },
    typography: { display: "Helvetica", body: "Times New Roman" },
    geometry: { radius: 0 },
    logoUrl: null,
    logo: null,
    imagery: { style: "no imagery at all, plain blue hyperlinks on white" },
    voice: {
      tone: "utilitarian, terse, lowercase",
      sample: "craigslist provides local classifieds and forums for jobs, housing, for sale, services, local community, and events",
      avoid: ["capital letters at the start of sentences", "marketing adjectives", "emoji", "any mention of a brand experience"],
    },
  },
};

export const FIXTURE_CONTENT: Record<string, ContentSet> = {
  stripe: {
    hook: "Every integration your business already runs, now in one place",
    caption:
      "The Stripe App Marketplace brings your billing, tax, and reporting tools into the same dashboard you already use. Install in a click. No engineering time required.",
    slides: [
      "Connect the tools you already pay for, without writing glue code.",
      "Install, configure, and revoke apps from the Stripe Dashboard.",
      "Every app reviewed against the same security bar as Stripe itself.",
      "Available today to all Stripe users, at no additional cost.",
    ],
    hashtags: ["payments", "fintech", "developers", "integrations"],
  },
  linear: {
    hook: "Integrations, without the tab-switching",
    caption:
      "The Linear Integration Directory is live. Connect your stack once and stop context-switching to keep issues in sync.",
    slides: [
      "One directory. Every tool your team already uses.",
      "Two-way sync that doesn't drift.",
      "Install in seconds. No admin ticket.",
      "Built on the Linear API you already have access to.",
    ],
    hashtags: ["buildinpublic", "producttools", "engineering"],
  },
  notion: {
    hook: "Your tools, finally in the same place",
    caption:
      "The new Notion Integration Gallery lets you pull the apps your team already uses straight into your workspace. Connect once, and your docs, tasks, and data stop living apart.",
    slides: [
      "Browse every integration in one gallery, right inside Notion.",
      "Connect a tool once and it works across every page you have.",
      "Built and reviewed by the people who make the tools you use.",
      "Free on every plan, starting today.",
    ],
    hashtags: ["notion", "productivity", "workspace"],
  },
  craigslist: {
    hook: "new: post to multiple categories at once",
    caption:
      "you can now cross-post a single listing to related categories without retyping it. same form, one extra checkbox. no account changes needed.",
    slides: [
      "one listing, up to three related categories",
      "no additional fee in most areas",
      "existing posts can be edited to add categories",
      "available in all us regions today",
    ],
    hashtags: ["classifieds", "local"],
  },
};
