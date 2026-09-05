import { z } from "zod";

/**
 * The shape everything downstream depends on. Locked at Step 1 on purpose:
 * extraction, generation and the templates all read from this, so a change
 * here is a change everywhere.
 */

const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color like #1A2B3C");

/**
 * The logo as captured pixels. Measured during the screenshot, never asked of
 * the model - same principle as SiteSignals. `background` records what it sat
 * on, which is how a template tells a white logo from a black one without
 * reading pixels.
 */
export const LogoAssetSchema = z.object({
  dataUri: z.string().startsWith("data:image/", "must be a data URI"),
  width: z.number(),
  height: z.number(),
  background: Hex,
  transparent: z.boolean().default(true),
  how: z.string(),
});

export type LogoAsset = z.infer<typeof LogoAssetSchema>;

export const BrandKitSchema = z.object({
  name: z.string().describe("The company or product name as they write it"),
  tagline: z.string().describe("Their own one-line positioning, in their words"),
  palette: z.object({
    primary: Hex.describe("The dominant brand color, the one you'd recognize them by"),
    ink: Hex.describe("Their darkest text color"),
    surface: Hex.describe("Their page/card background color"),
    accent: Hex.describe("A secondary color used for emphasis"),
  }),
  typography: z.object({
    display: z.string().describe("Headline typeface family name as used on the site"),
    body: z.string().describe("Body typeface family name as used on the site"),
  }),
  geometry: z.object({
    radius: z.number().describe("Corner radius in px seen on their buttons and cards"),
  }),
  logoUrl: z.string().nullable().describe("Absolute URL to a logo image, or null"),
  /** Defaulted so kits saved before logo capture existed still validate. */
  logo: LogoAssetSchema.nullable().default(null),
  imagery: z.object({
    style: z.string().describe("Their visual language in a phrase, e.g. 'flat gradients, no photography'"),
  }),
  voice: z.object({
    tone: z.string().describe("How they sound, in a phrase"),
    sample: z.string().describe("A real sentence lifted from their site that shows the voice"),
    avoid: z.array(z.string()).describe("Words and moves that would sound wrong for this brand"),
  }),
});

export const ContentSetSchema = z.object({
  hook: z.string().describe("The single line that stops the scroll"),
  caption: z.string().describe("The post caption, in the brand's voice"),
  slides: z.array(z.string()).length(4).describe("Exactly 4 slide lines"),
  hashtags: z.array(z.string()).describe("Hashtags, without the # prefix"),
});

export type BrandKit = z.infer<typeof BrandKitSchema>;
export type ContentSet = z.infer<typeof ContentSetSchema>;

/**
 * Hard rule 2: never throw on a bad LLM response. Validate, retry once,
 * then fall back to this.
 */
export const DEFAULT_BRAND_KIT: BrandKit = {
  name: "Unknown",
  tagline: "",
  palette: {
    primary: "#2B2B2B",
    ink: "#111111",
    surface: "#FAFAFA",
    accent: "#6B6B6B",
  },
  typography: { display: "Inter", body: "Inter" },
  geometry: { radius: 8 },
  logoUrl: null,
  logo: null,
  imagery: { style: "neutral, typographic, no photography" },
  voice: {
    tone: "plain and direct",
    sample: "",
    avoid: ["hype", "exclamation marks"],
  },
};

export const DEFAULT_CONTENT_SET: ContentSet = {
  hook: "",
  caption: "",
  slides: ["", "", "", ""],
  hashtags: [],
};

export type TemplateId = "statement" | "split";

/* ------------------------------------------------------------------ *
 * Stage 2.5: marketing footprint audit -> plan
 *
 * SiteSignals is *measured*, not asked for. It is what we can actually see
 * from outside the company: which social accounts they link, which content
 * surfaces exist, which marketing tech is loaded on the page. The model gets
 * these as evidence so the plan is grounded in their real footprint rather
 * than a generic playbook.
 * ------------------------------------------------------------------ */

export const SiteSignalsSchema = z.object({
  socials: z.array(z.object({ platform: z.string(), url: z.string() })),
  /** Content surfaces: linked from the homepage, and/or reachable by probe. */
  surfaces: z.array(
    z.object({
      label: z.string(),
      path: z.string(),
      linked: z.boolean(),
      reachable: z.boolean(),
    }),
  ),
  /** Marketing/analytics tech detected in page scripts, grouped by what it means. */
  martech: z.array(z.object({ name: z.string(), category: z.string() })),
  hasNewsletterCapture: z.boolean(),
  hasOgImage: z.boolean(),
  hasTwitterCard: z.boolean(),
  hasRss: z.boolean(),
  /** Sites that answer 200 to any path make surface probes meaningless. */
  softNotFound: z.boolean(),
  degraded: z.boolean(),
});

export type SiteSignals = z.infer<typeof SiteSignalsSchema>;

export const EMPTY_SIGNALS: SiteSignals = {
  socials: [],
  surfaces: [],
  martech: [],
  hasNewsletterCapture: false,
  hasOgImage: false,
  hasTwitterCard: false,
  hasRss: false,
  softNotFound: false,
  degraded: true,
};

/* ------------------------------------------------------------------ *
 * Stage 2.6: who buys this, who else sells it, what number proves it
 *
 * Footprint says what this company has already done. For an early-stage
 * founder that is nearly always "nothing", which is true but thin. What they
 * actually lack is a named buyer, a read on the field, and one number to
 * chase. That is this stage.
 *
 * Split in two because the two halves have completely different costs:
 * Audience is read off their own copy in ~20s, Competitors needs live web
 * search and takes minutes. They arrive separately and the UI shows each as
 * it lands.
 * ------------------------------------------------------------------ */

export const AudienceSchema = z.object({
  /** Read off the evidence, not asked of the founder. */
  stage: z
    .enum(["pre-launch", "just-launched", "early-traction"])
    .describe("pre-launch = no product signal; just-launched = live but no audience; early-traction = real users"),
  positioning: z
    .string()
    .describe("One line in their own register: for WHO, we do WHAT, unlike WHAT ELSE. Under 140 characters"),
  icp: z.array(
    z.object({
      name: z.string().describe("A person, not a market. 'Solo ceramicist selling at weekend markets', not 'SMBs'"),
      signals: z.array(z.string()).describe("Up to 3 ways to recognise one in the wild, each under 70 characters"),
      pain: z.string().describe("One sentence: the specific thing that makes them pull out a card"),
      where: z
        .array(z.string())
        .describe("Up to 3 named places they already gather - a subreddit, a Slack, a conference, a newsletter. Never 'social media'"),
    }),
  ),
  kpis: z.object({
    northStar: z.object({
      metric: z.string().describe("The single number. Under 40 characters"),
      target: z.string().describe("Absolute and time-boxed. A founder has no baseline, so never '+15%'"),
      why: z.string().describe("One sentence: what you would do differently if it missed"),
    }),
    supporting: z.array(
      z.object({
        metric: z.string(),
        target: z.string().describe("Absolute and time-boxed"),
        why: z.string().describe("One sentence"),
      }),
    ),
  }),
});

export type Audience = z.infer<typeof AudienceSchema>;

export const CompetitorsSchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      url: z.string().describe("A real URL seen in search results, never guessed"),
      positioning: z.string().describe("One sentence, how they sell themselves"),
      theirEdge: z.string().describe("One sentence: what they genuinely do better"),
      yourOpening: z.string().describe("One sentence: the gap a small newcomer could take from them"),
    }),
  ),
  /** Honest when search found little - an empty list with a reason beats invented rivals. */
  note: z.string().describe("If search returned nothing useful, say so plainly here. Otherwise empty string"),
});

export type Competitors = z.infer<typeof CompetitorsSchema>;

export const DEFAULT_AUDIENCE: Audience = {
  stage: "pre-launch",
  positioning: "",
  icp: [],
  kpis: {
    northStar: { metric: "Customer conversations", target: "20 in the next 30 days", why: "Below this you are guessing at the problem" },
    supporting: [],
  },
};

export const DEFAULT_COMPETITORS: Competitors = {
  competitors: [],
  note: "We could not research the field for this company.",
};

export const MarketingPlanSchema = z.object({
  audit: z.object({
    maturity: z
      .enum(["invisible", "emerging", "active", "advanced"])
      .describe("How much marketing is already out there, judged on the evidence"),
    headline: z
      .string()
      .describe("The verdict as one short clause under 70 characters. Not a sentence with a comma splice"),
    summary: z.string().describe("Two sentences, maximum three, on where they actually stand"),
    strengths: z.array(z.string()).describe("Up to 3. Each under 90 characters, each pointing at evidence"),
    gaps: z.array(z.string()).describe("Up to 3, most costly first. Each under 90 characters"),
  }),
  channels: z.array(
    z.object({
      name: z.string().describe("Just the platform name, 1-3 words. 'LinkedIn', not 'LinkedIn company page strategy'"),
      /**
       * Not asked of the model - computed from what we actually found. We can
       * see whether a company links an account; we cannot see whether they
       * post to it, so there is no "active" here on purpose.
       */
      presence: z
        .enum(["linked", "absent", "unverifiable"])
        .describe("linked = we found an account link; absent = we looked and found none; unverifiable = not visible from a homepage"),
      move: z
        .enum(["start-here", "next", "later", "skip"])
        .describe("Exactly one channel is start-here"),
      cadence: z.string().describe("Posting rhythm in under 60 characters, e.g. '3x/week, Tue-Thu mornings'"),
      rationale: z.string().describe("One sentence. Why this channel for this specific company"),
    }),
  ),
  contentTypes: z.array(
    z.object({
      name: z.string().describe("Short label, 1-3 words, e.g. 'Customer proof'"),
      why: z.string().describe("One sentence on why this format suits this brand right now"),
      topic: z
        .string()
        .describe(
          "A specific, ready-to-write post topic for this company - not a category. " +
            "This gets fed straight to the copywriter, so make it concrete.",
        ),
    }),
  ),
  experiments: z.array(
    z.object({
      name: z.string(),
      hypothesis: z.string().describe("One falsifiable 'if we X, then Y' sentence"),
      method: z.string().describe("One or two sentences. How to run it inside two weeks"),
      readout: z.string().describe("One sentence: what you measure and when you call it"),
    }),
  ),
  timeline: z.array(
    z.object({
      window: z.string().describe("e.g. 'Weeks 1-2'"),
      focus: z.string().describe("One short clause"),
      deliverables: z.array(z.string()).describe("Up to 3 countable things, each under 70 characters"),
    }),
  ),
});

export type MarketingPlan = z.infer<typeof MarketingPlanSchema>;

export const DEFAULT_MARKETING_PLAN: MarketingPlan = {
  audit: {
    maturity: "emerging",
    headline: "Not enough signal to judge the current footprint",
    summary:
      "We could not read enough of this site to audit its marketing. The plan below is a generic starting point, not a read of this company.",
    strengths: [],
    gaps: ["We could not verify any existing marketing surface"],
  },
  channels: [],
  contentTypes: [],
  experiments: [],
  timeline: [],
};
