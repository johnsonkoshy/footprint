import { z } from "zod";

/**
 * The shape everything downstream depends on. Locked at Step 1 on purpose:
 * extraction, generation and the templates all read from this, so a change
 * here is a change everywhere.
 */

const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color like #1A2B3C");

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
