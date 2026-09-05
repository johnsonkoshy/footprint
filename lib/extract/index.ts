import Anthropic from "@anthropic-ai/sdk";
import { getClient, hasApiKey, EXTRACT_MODEL, MISSING_KEY_MESSAGE } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BrandKitSchema, DEFAULT_BRAND_KIT, type BrandKit, type SiteSignals } from "@/types";
import { signalsFromPage } from "@/lib/strategy/signals";
import { fetchSite, type LogoCapture, type SiteCapture } from "./fetchSite";
import { resolveFont } from "./fonts";

/**
 * The schema we hand the model is deliberately looser than BrandKitSchema -
 * plain strings, no regex, no fixed lengths. Grammar-constrained decoding and
 * regex don't always mix, and hard rule 2 says the guarantee comes from
 * validating the result, not from trusting the request.
 */
const BrandKitDraftSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  palette: z.object({
    primary: z.string().describe("6-digit hex, e.g. #635BFF"),
    ink: z.string().describe("6-digit hex"),
    surface: z.string().describe("6-digit hex"),
    accent: z.string().describe("6-digit hex"),
  }),
  typography: z.object({
    display: z
      .string()
      .describe(
        "ONLY the family name, 1-3 words. e.g. 'Söhne' or 'GT America'. If you " +
          "don't recognise it, give a bare classification instead: 'geometric sans', " +
          "'neo-grotesque', 'transitional serif', 'slab serif', or 'mono'. Never a " +
          "sentence, never a description, never tracking or weight notes.",
      ),
    body: z.string().describe("Same rule: family name or bare classification only."),
  }),
  geometry: z.object({ radius: z.number() }),
  logoUrl: z.string().nullable(),
  imagery: z.object({ style: z.string() }),
  voice: z.object({
    tone: z.string(),
    sample: z.string(),
    avoid: z.array(z.string()),
  }),
});

const SYSTEM = `You are a brand designer conducting a visual identity audit. A client
has handed you a screenshot of a company's homepage and the copy from that page,
and asked you to write down their identity precisely enough that another designer
could produce on-brand work without ever seeing the site.

How to look at the screenshot:

PALETTE. Find the colour this brand owns - the one on their primary button, their
logo, their hero. That is "primary", and it is almost never grey. Grey is what you
report when a brand genuinely has no colour, not when you were not looking hard
enough. "ink" is the darkest text colour actually used, "surface" is the page
background, "accent" is the secondary colour used for emphasis, links, or
illustration. Report exact 6-digit hex, sampled from what you can see.

TYPE. Give the family NAME and nothing else - designers know Söhne, Circular,
GT America, Tiempos on sight, so name them. If you do not recognise it, give a
bare two-word classification instead: "geometric sans", "neo-grotesque",
"transitional serif", "slab serif", "mono". This field is machine-read to pick a
substitute font, so it must be a name, not a sentence. No tracking notes, no
x-height commentary, no parentheticals. Do not default to Helvetica or Inter
because they are safe.

GEOMETRY. Look at the buttons and cards and report their corner radius in px.
Sharp corners are 0. A pill is large. This single number carries a lot of brand.

IMAGERY. One phrase describing their visual language as a rule someone could
follow: "flat vector illustration, no photography, heavy gradients" or
"full-bleed product screenshots on white". Say what they do NOT use if that is
the more distinctive fact.

VOICE. Read the actual copy, not the industry. "tone" is a phrase. "sample" must
be a real sentence lifted or closely modelled on their page - never an adjective,
never a description of the voice. "avoid" is 3-6 concrete moves that would read as
off-brand for this specific company: words they never use, punctuation they never
reach for, registers they stay out of. "Avoid jargon" is useless. "Never says
'revolutionise', never uses exclamation marks, never addresses the reader as
'folks'" is useful.

Be decisive. A confident wrong answer is more useful here than a hedge, because
the human reviews the kit before anything is generated from it.`;

function buildUserContent(site: SiteCapture): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];

  if (site.screenshot) {
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: site.screenshot },
    });
  }

  const facts = [
    `URL: ${site.url}`,
    `Page title: ${site.title || "(none)"}`,
    `Meta description: ${site.description || "(none)"}`,
    `og:image: ${site.ogImage ?? "(none)"}`,
    `favicon: ${site.favicon ?? "(none)"}`,
    site.logoCandidates.length
      ? `Logo image candidates (pick the best one for logoUrl, or null if none is a real logo):\n${site.logoCandidates.map((u) => `  - ${u}`).join("\n")}`
      : `Logo image candidates: (none found)`,
  ].join("\n");

  const preamble = site.screenshot
    ? "Above is a screenshot of this company's homepage. Here is the page data and copy."
    : `NOTE: this site blocked our headless browser, so there is NO screenshot - you are
working from copy alone. Infer the palette from the brand's known identity if you
recognise the company, otherwise report an honest neutral palette rather than
inventing colours. Reason: ${site.note ?? "unknown"}`;

  blocks.push({
    type: "text",
    text: `${preamble}\n\n${facts}\n\n--- PAGE COPY ---\n${site.text || "(no text recovered)"}`,
  });

  return blocks;
}

/** Fix the trivial format slips so we don't burn a retry on them. */
function coerceKit(
  draft: z.infer<typeof BrandKitDraftSchema>,
  logo: LogoCapture | null,
): unknown {
  const hex = (v: string): string => {
    let s = (v ?? "").trim();
    if (!s.startsWith("#")) s = `#${s}`;
    // #abc -> #aabbcc
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
    }
    // Drop an alpha channel if the model volunteered one.
    if (/^#[0-9a-f]{8}$/i.test(s)) s = s.slice(0, 7);
    return s.toUpperCase();
  };

  return {
    ...draft,
    palette: {
      primary: hex(draft.palette.primary),
      ink: hex(draft.palette.ink),
      surface: hex(draft.palette.surface),
      accent: hex(draft.palette.accent),
    },
    geometry: { radius: Math.max(0, Math.round(draft.geometry.radius)) },
    logoUrl: draft.logoUrl?.trim() ? draft.logoUrl.trim() : null,
    logo,
    voice: { ...draft.voice, avoid: draft.voice.avoid.slice(0, 8) },
  };
}

export type ExtractionResult = {
  /** Free marketing-footprint read from the same page load. Probes come later. */
  signals: SiteSignals;
  /** The homepage copy. The market stage reads their buyer out of this. */
  text: string;
  kit: BrandKit;
  /** true when both attempts failed validation and we served DEFAULT_BRAND_KIT */
  usedFallback: boolean;
  degraded: boolean;
  fonts: { display: ReturnType<typeof resolveFont>; body: ReturnType<typeof resolveFont> };
  model: string;
  notes: string[];
  usage?: { input: number; output: number };
};

export async function extractBrandKit(
  rawUrl: string,
  opts: {
    onStage?: (stage: string) => void;
    /**
     * Fires the moment the page has been photographed, 15+ seconds before the
     * audit returns. The streaming route uses it to put the screenshot on
     * screen while the model is still looking at it.
     */
    onCapture?: (site: SiteCapture, signals: SiteSignals) => void;
    browser?: Parameters<typeof fetchSite>[1];
  } = {},
): Promise<ExtractionResult> {
  const notes: string[] = [];

  opts.onStage?.("screenshotting");
  const site = await fetchSite(rawUrl, opts.browser);
  if (site.degraded) notes.push(site.note ?? "no screenshot");

  // Free: derived from the page we just loaded, no extra requests. The audit
  // stage adds HTTP probes on top of this only when the user asks for a plan.
  const signals = signalsFromPage(rawUrl, site.raw, Boolean(site.ogImage));
  opts.onCapture?.(site, signals);
  if (site.logo) {
    notes.push(`logo captured via ${site.logo.how} (${site.logo.width}x${site.logo.height})`);
  } else if (site.logoNote) {
    notes.push(site.logoNote);
  }

  opts.onStage?.("analyzing");

  if (!hasApiKey()) {
    notes.push(MISSING_KEY_MESSAGE);
    return {
      kit: { ...DEFAULT_BRAND_KIT, name: site.title || DEFAULT_BRAND_KIT.name, logo: site.logo },
      usedFallback: true,
      degraded: site.degraded,
      model: EXTRACT_MODEL,
      fonts: {
        display: resolveFont(DEFAULT_BRAND_KIT.typography.display),
        body: resolveFont(DEFAULT_BRAND_KIT.typography.body),
      },
      notes,
      signals,
      text: site.text,
    };
  }

  const client = getClient();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserContent(site) },
  ];

  let usage: ExtractionResult["usage"];

  // Hard rule 2: forced schema, validate, retry once, then fall back.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: EXTRACT_MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages,
        output_config: { format: zodOutputFormat(BrandKitDraftSchema) },
      });

      usage = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      };

      if (response.stop_reason === "refusal") {
        notes.push(`refused: ${response.stop_details?.category ?? "unknown"}`);
        break;
      }

      const draft = response.parsed_output;
      if (!draft) {
        notes.push(`attempt ${attempt + 1}: model returned no parsable output`);
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: "That did not parse. Return the audit again, matching the schema exactly.",
        });
        continue;
      }

      const validated = BrandKitSchema.safeParse(coerceKit(draft, site.logo));
      if (validated.success) {
        const kit = validated.data;
        return {
          kit,
          usedFallback: false,
          degraded: site.degraded,
          model: EXTRACT_MODEL,
          fonts: {
            display: resolveFont(kit.typography.display),
            body: resolveFont(kit.typography.body),
          },
          notes,
          usage,
          signals,
          text: site.text,
        };
      }

      const issues = validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      notes.push(`attempt ${attempt + 1} failed validation: ${issues}`);
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: `That failed validation: ${issues}. Return the whole audit again with those fields corrected. Colours must be 6-digit hex like #635BFF.`,
      });
    } catch (err) {
      notes.push(`attempt ${attempt + 1} threw: ${String(err).slice(0, 300)}`);
      if (attempt === 1) break;
    }
  }

  return {
    kit: { ...DEFAULT_BRAND_KIT, name: site.title || DEFAULT_BRAND_KIT.name, logo: site.logo },
    usedFallback: true,
    degraded: site.degraded,
    model: EXTRACT_MODEL,
    fonts: {
      display: resolveFont(DEFAULT_BRAND_KIT.typography.display),
      body: resolveFont(DEFAULT_BRAND_KIT.typography.body),
    },
    notes,
    usage,
    signals,
    text: site.text,
  };
}
