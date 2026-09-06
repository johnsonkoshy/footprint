import Anthropic from "@anthropic-ai/sdk";
import { getClient, hasApiKey, GENERATE_MODEL, MISSING_KEY_MESSAGE } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ContentSetSchema, DEFAULT_CONTENT_SET, type BrandKit, type ContentSet } from "@/types";

/** Loose for the model, strict on the way back in - same contract as extraction. */
const ContentDraftSchema = z.object({
  hook: z.string(),
  caption: z.string(),
  slides: z.array(z.string()),
  hashtags: z.array(z.string()),
});

const SYSTEM = `You are a social copywriter embedded at one specific company. You have
their brand voice guide in front of you and you write only as them.

The voice constraints you are given are not suggestions:

- voice.tone tells you the register. Match it.
- voice.sample is a real sentence from their own site. Your copy must sound like
  it came from the same writer. Read its rhythm, its sentence length, its
  appetite for punctuation, whether it addresses the reader directly.
- voice.avoid is ABSOLUTE. Every item is a move this company never makes. Do not
  make any of them, not once, not "in a knowing way". If an item says no
  exclamation marks, your output contains zero exclamation marks. If it says
  never use the word "solution", that word does not appear.

What to write:

hook - the line that stops the scroll. One line. It carries the whole post, and
it gets set at display size, so keep it under about 60 characters. No colon-
subtitle constructions. It must be a thing this company would actually say, not
a generic announcement template.

caption - two or three sentences. This is where the substance goes. Specific
over clever.

slides - exactly 4. Each is one line for a carousel frame. Each makes a distinct
point; do not restate the hook four times. Keep each under about 90 characters.

hashtags - 3 to 5, lowercase, no # prefix. Match how this specific company would
tag, which for some brands means almost none and nothing playful.

The single failure mode that matters: writing copy that would work equally well
for any company in this industry. If you could swap the logo and nobody would
notice, you have failed. Write something only this brand could have written.`;

/**
 * Set once the user has confirmed a plan. It narrows the writing job from
 * "a post" to "this format, for this channel" - a LinkedIn customer story and
 * an X changelog note are not the same piece of writing.
 */
/**
 * The control. A competent generalist with exactly what a URL-level tool has -
 * the company's name, tagline and the topic - and none of what makes this
 * product different: no tone, no sample sentence, no list of moves the brand
 * never makes. Not a strawman: this is the market's actual setup, and the
 * point is to let a founder see the difference rather than take our word.
 */
const GENERIC_SYSTEM = `You are a capable social media copywriter. You have the company's
name, their one-line tagline, and a topic. Write an engaging post set that would perform
well on social media.

hook - one punchy line that grabs attention, under about 60 characters.
caption - two or three sentences with a clear call to action.
slides - exactly 4 short lines for a carousel.
hashtags - 3 to 5, lowercase, no # prefix.

Be energetic and clear. Use the conventions that work on the platform.`;

/** What a voice-fidelity readout needs: which rules we could check, and how they fared. */
export type Fidelity = {
  /** voice.avoid rules we can test mechanically */
  checked: number;
  held: number;
  violations: string[];
  hookChars: number;
  /** under the display-size budget the templates are built for */
  hookFits: boolean;
};

export function measureFidelity(kit: BrandKit, content: ContentSet): Fidelity {
  const testable = kit.voice.avoid.filter((rule) => isTestable(rule));
  const violations = testable.filter((rule) => breaks(rule, content));
  return {
    checked: testable.length,
    held: testable.length - violations.length,
    violations,
    hookChars: content.hook.length,
    hookFits: content.hook.length <= 60,
  };
}

export type Brief = {
  channel?: string;
  format?: string;
  cadence?: string;
};

function buildPrompt(kit: BrandKit, topic: string, brief?: Brief): string {
  const placement =
    brief?.channel || brief?.format
      ? `\nWHERE THIS RUNS\n${[
          brief.channel && `Channel: ${brief.channel}. Write to that platform's conventions - length, formality, how people read there.`,
          brief.format && `Format: ${brief.format}.`,
        ]
          .filter(Boolean)
          .join("\n")}\n`
      : "";

  return `BRAND: ${kit.name}
Tagline: ${kit.tagline}
Imagery language: ${kit.imagery.style}

VOICE GUIDE
tone: ${kit.voice.tone}
sample sentence from their own site: "${kit.voice.sample}"
never do these (absolute): ${kit.voice.avoid.map((a) => `\n  - ${a}`).join("")}

${placement}
TOPIC TO WRITE ABOUT
${topic}

Write the post set as ${kit.name} would.`;
}

export type GenerationResult = {
  content: ContentSet;
  fidelity: Fidelity;
  usedFallback: boolean;
  model: string;
  notes: string[];
  usage?: { input: number; output: number };
};

export async function generateContent(
  kit: BrandKit,
  topic: string,
  brief?: Brief,
  opts: { control?: boolean } = {},
): Promise<GenerationResult> {
  const notes: string[] = [];
  const fallback = { ...DEFAULT_CONTENT_SET, hook: kit.tagline, caption: kit.tagline };

  if (!hasApiKey()) {
    return {
      content: fallback,
      fidelity: measureFidelity(kit, fallback),
      usedFallback: true,
      model: GENERATE_MODEL,
      notes: [MISSING_KEY_MESSAGE],
    };
  }

  const client = getClient();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: opts.control ? buildGenericPrompt(kit, topic, brief) : buildPrompt(kit, topic, brief),
    },
  ];
  let usage: GenerationResult["usage"];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: GENERATE_MODEL,
        max_tokens: 16000,
        system: opts.control ? GENERIC_SYSTEM : SYSTEM,
        messages,
        output_config: { format: zodOutputFormat(ContentDraftSchema) },
      });

      usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

      if (response.stop_reason === "refusal") {
        notes.push(`refused: ${response.stop_details?.category ?? "unknown"}`);
        break;
      }

      const draft = response.parsed_output;
      if (draft) {
        // Pad or trim to exactly 4 rather than burning a retry on an off-by-one.
        const slides = [...draft.slides].slice(0, 4);
        while (slides.length < 4) slides.push("");

        const validated = ContentSetSchema.safeParse({
          ...draft,
          slides,
          hashtags: draft.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
        });

        if (validated.success) {
          const fidelity = measureFidelity(kit, validated.data);
          if (fidelity.violations.length && !opts.control) {
            notes.push(`possible voice violations: ${fidelity.violations.join("; ")}`);
          }
          return { content: validated.data, fidelity, usedFallback: false, model: GENERATE_MODEL, notes, usage };
        }

        const issues = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        notes.push(`attempt ${attempt + 1} failed validation: ${issues}`);
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: `That failed validation: ${issues}. Return it again, corrected.` });
        continue;
      }

      notes.push(`attempt ${attempt + 1}: no parsable output`);
    } catch (err) {
      notes.push(`attempt ${attempt + 1} threw: ${String(err).slice(0, 300)}`);
      if (attempt === 1) break;
    }
  }

  return {
    content: fallback,
    fidelity: measureFidelity(kit, fallback),
    usedFallback: true,
    model: GENERATE_MODEL,
    notes,
    usage,
  };
}

function buildGenericPrompt(kit: BrandKit, topic: string, brief?: Brief): string {
  return `COMPANY: ${kit.name}
Tagline: ${kit.tagline}
${brief?.channel ? `Platform: ${brief.channel}` : ""}

TOPIC
${topic}

Write the post set.`;
}

/** Only rules `breaks()` can actually evaluate count toward the score. */
function isTestable(rule: string): boolean {
  const r = rule.toLowerCase();
  return r.includes("exclamation") || /["'“](.+?)["'”]/.test(rule);
}

/**
 * A cheap smoke test for the two voice rules that are mechanically checkable.
 * Advisory only - it annotates the result, it never rejects it.
 */
function breaks(rule: string, content: ContentSet): boolean {
  const all = [content.hook, content.caption, ...content.slides].join(" ");
  const r = rule.toLowerCase();

  if (r.includes("exclamation")) return all.includes("!");
  const quoted = rule.match(/["'“](.+?)["'”]/)?.[1];
  if (quoted) return new RegExp(`\\b${quoted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(all);
  return false;
}
