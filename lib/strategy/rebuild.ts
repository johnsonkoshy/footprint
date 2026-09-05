import Anthropic from "@anthropic-ai/sdk";
import { getClient, hasApiKey, STRATEGY_MODEL, MISSING_KEY_MESSAGE } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MarketingPlanSchema, type Audience, type BrandKit, type MarketingPlan } from "@/types";

/**
 * The founder picks the channels and formats; this writes the plan for exactly
 * those. The first strategy call proposes a plan, which is right most of the
 * time - but a founder who knows their buyer better than we do should be able
 * to say "not Instagram, and I want a newsletter" and get a plan that reflects
 * it rather than a filtered version of ours.
 *
 * Everything else stays fixed: same brand, same buyer, same north star. Only
 * cadence, briefs, experiments and the quarter are rewritten.
 */

const Body = MarketingPlanSchema.omit({ audit: true });
export type PlanBody = z.infer<typeof Body>;

const Draft = z.object({
  channels: z.array(
    z.object({ name: z.string(), move: z.string(), cadence: z.string(), rationale: z.string() }),
  ),
  contentTypes: z.array(z.object({ name: z.string(), why: z.string(), topic: z.string() })),
  experiments: z.array(
    z.object({ name: z.string(), hypothesis: z.string(), method: z.string(), readout: z.string() }),
  ),
  timeline: z.array(
    z.object({ window: z.string(), focus: z.string(), deliverables: z.array(z.string()) }),
  ),
});

const SYSTEM = `You are a marketing strategist advising a very early stage founder - one or
two people, no marketing hire, a couple of hours a week, no budget. Recommend things one
person can do on a Tuesday, never a campaign.

The founder has already chosen their channels and the formats they want to make. That
decision is FINAL and it is not yours to relitigate. Do not add a channel they did not
pick, do not drop one they did, and do not spend a sentence arguing for something else.
If a choice looks hard for them, the useful response is a cadence and a format that makes
it survivable, not a lecture.

Write the plan for exactly what they chose:

channels - one entry per chosen channel, in the order given. "move" is "start-here" for
the first and "next" for the rest. Cadence is concrete: how often and when, sized for a
couple of hours a week across ALL of their channels combined. If they picked four
channels, each cadence has to shrink accordingly - say so in the rationale.

contentTypes - one entry per chosen format. The "topic" is the important field: a
specific post this company could publish next week, concrete enough to hand to a writer.
Not a category.

experiments - exactly 2, and both must run on the channels they actually chose. Each
needs a hypothesis that could come back negative.

timeline - 3 phases over roughly a quarter, using only the chosen channels. Deliverables
are countable.

Everything must plausibly move the north star you are given. Be brief: one sentence per
field, no field restating another.`;

function prompt(
  kit: BrandKit,
  audience: Audience | null,
  channels: string[],
  formats: string[],
  goal: string,
): string {
  return `COMPANY: ${kit.name}
${kit.tagline}
How they sound: ${kit.voice.tone}
Never: ${kit.voice.avoid.join("; ")}

${
  audience
    ? `BUYER
${audience.icp.map((p) => `- ${p.name}: ${p.pain}${p.where.length ? ` (found at ${p.where.join(", ")})` : ""}`).join("\n")}

THE NUMBER THIS PLAN MUST MOVE
${audience.kpis.northStar.metric} - ${audience.kpis.northStar.target}`
    : ""
}

THE FOUNDER CHOSE THESE CHANNELS, IN THIS ORDER
${channels.map((c, i) => `${i + 1}. ${c}`).join("\n")}

AND THESE FORMATS
${formats.map((f) => `- ${f}`).join("\n")}
${goal.trim() ? `\nTHEIR CONSTRAINT\n${goal.trim()}\n` : ""}
Write the plan for exactly that.`;
}

export type RebuildResult = {
  plan: PlanBody;
  usedFallback: boolean;
  model: string;
  notes: string[];
  usage?: { input: number; output: number };
};

export async function rebuildPlan(
  kit: BrandKit,
  audience: Audience | null,
  channels: string[],
  formats: string[],
  goal: string,
  previous: PlanBody,
): Promise<RebuildResult> {
  const notes: string[] = [];
  if (!hasApiKey()) {
    return { plan: previous, usedFallback: true, model: STRATEGY_MODEL, notes: [MISSING_KEY_MESSAGE] };
  }

  const client = getClient();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt(kit, audience, channels, formats, goal) },
  ];
  let usage: RebuildResult["usage"];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: STRATEGY_MODEL,
        max_tokens: 12000,
        system: SYSTEM,
        messages,
        output_config: { format: zodOutputFormat(Draft) },
      });
      usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

      if (response.stop_reason === "refusal") {
        notes.push(`refused: ${response.stop_details?.category ?? "unknown"}`);
        break;
      }

      const draft = response.parsed_output;
      if (draft) {
        const moves = ["start-here", "next", "later", "skip"];
        const norm = (v: string) => v.trim().toLowerCase().replace(/[\s_]+/g, "-");
        // Presence is evidence and does not change with the founder's pick, so
        // carry it over from the proposal rather than asking for it again.
        const presenceOf = (name: string) =>
          previous.channels.find((c) => c.name.toLowerCase() === name.toLowerCase())?.presence ?? "unverifiable";

        const built = {
          channels: draft.channels.slice(0, 5).map((c, i) => ({
            ...c,
            presence: presenceOf(c.name),
            move: moves.includes(norm(c.move)) ? norm(c.move) : i === 0 ? "start-here" : "next",
          })),
          contentTypes: draft.contentTypes.slice(0, 4),
          experiments: draft.experiments.slice(0, 2),
          timeline: draft.timeline.slice(0, 3).map((t) => ({ ...t, deliverables: t.deliverables.slice(0, 3) })),
        };

        const validated = Body.safeParse(built);
        if (validated.success) {
          return { plan: validated.data, usedFallback: false, model: STRATEGY_MODEL, notes, usage };
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

  // Falling back to the proposal is safe: it is a real plan, just not theirs.
  return { plan: previous, usedFallback: true, model: STRATEGY_MODEL, notes, usage };
}

export function planBodyOf(plan: MarketingPlan): PlanBody {
  return {
    channels: plan.channels,
    contentTypes: plan.contentTypes,
    experiments: plan.experiments,
    timeline: plan.timeline,
  };
}
