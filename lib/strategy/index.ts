import Anthropic from "@anthropic-ai/sdk";
import { getClient, hasApiKey, STRATEGY_MODEL, MISSING_KEY_MESSAGE } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  MarketingPlanSchema,
  DEFAULT_MARKETING_PLAN,
  type Audience,
  type BrandKit,
  type MarketingPlan,
  type SiteSignals,
} from "@/types";
import { describeSignals, DETECTABLE_PLATFORMS } from "./signals";

/** Loose for the model, strict on the way back - same contract as the other two stages. */
const PlanDraftSchema = z.object({
  audit: z.object({
    maturity: z.string(),
    headline: z.string(),
    summary: z.string(),
    strengths: z.array(z.string()),
    gaps: z.array(z.string()),
  }),
  channels: z.array(
    z.object({
      name: z.string(),
      move: z.string(),
      cadence: z.string(),
      rationale: z.string(),
    }),
  ),
  contentTypes: z.array(z.object({ name: z.string(), why: z.string(), topic: z.string() })),
  experiments: z.array(
    z.object({
      name: z.string(),
      hypothesis: z.string(),
      method: z.string(),
      readout: z.string(),
    }),
  ),
  timeline: z.array(
    z.object({ window: z.string(), focus: z.string(), deliverables: z.array(z.string()) }),
  ),
});

const SYSTEM = `You are a marketing strategist advising a very early stage founder - one
or two people, no marketing hire, a couple of hours a week, no budget. Recommend things
one person can do on a Tuesday, never a campaign. You have never spoken to this company. Everything you know is on the page in front of you: their brand,
their voice, and a list of what we could actually observe about their marketing footprint.

Read the EVIDENCE block literally. It is measured, not guessed.

- "NONE" means we looked and found nothing. Say so. Do not invent a LinkedIn presence
  because a B2B company usually has one.
- A linked social account means the account exists. It does NOT mean it is active - we
  cannot see post frequency, so never claim to know it.
- Marketing tech is the strongest tell you have. Ad pixels mean they are already spending
  money on acquisition. An experimentation tool means someone measures. Marketing
  automation means there is a funnel and a person who owns it. Nothing but a basic
  analytics script means marketing is probably one person's side responsibility.
- If the evidence is thin, set maturity honestly and say what you could not verify. An
  under-confident audit is useful. A confident wrong one is not.

Now write the plan.

audit.maturity - one of: invisible, emerging, active, advanced. Justify it from the
evidence, not from how famous the company is. A well-known company with no content
surfaces and no pixels is still "emerging" at content marketing.

channels - exactly 4. The "name" is a platform, nothing more: "LinkedIn", not "LinkedIn
company page with repurposed changelog content". Rank them with the "move" field: exactly
one is "start-here", then "next", "later", or "skip". Skip is a real answer and you should
use it when a platform would be wrong for this brand. The order must follow from who this
company sells to and how they already sound, not from platform popularity. Give each a
concrete cadence: how often, and when. "Regularly" is not a cadence.

contentTypes - exactly 3 formats worth making. The "topic" field on each is the important
one: it goes straight to a copywriter as a brief, so it must be a specific post this
company could publish next week. "Thought leadership about the industry" is useless.
"The three integrations customers ask for most, and why we built the API that way" is a
brief.

experiments - exactly 2. Each needs a hypothesis you could be wrong about. If you cannot
imagine the result coming back negative, it is not an experiment, it is a task.

timeline - 3 phases covering roughly the first quarter. Deliverables are countable
things, not intentions.

If a BUYER block is present, it is the brief. The channels you pick are the ones where
those specific people already are - the "where" entries are named for you, so use them
instead of reaching for whichever platform is largest. Every recommendation must plausibly
move the north star metric; if it cannot, do not recommend it. Do not restate the KPIs,
they are already on screen above your plan.

Be brief everywhere. Every field is read at a glance in a UI, not in a document. One
sentence where one sentence will do, and no field restates another.

Two rules that override everything above:

1. Respect the brand's voice. Their "avoid" list applies to the plan as much as to the
   copy. Do not recommend a channel or format that would require them to sound like
   someone else. Some companies should be told to post less, in fewer places, plainly.

2. The failure mode that matters: a plan that would fit any company in this industry.
   If you could paste a different logo at the top and the plan would still read fine,
   you have written a template, not a strategy. Every rationale must point at something
   specific about this company.`;

function describeAudience(a: Audience): string {
  return `BUYER - already established, write the plan for these people
Stage: ${a.stage}
Positioning: ${a.positioning}
${a.icp
  .map(
    (p) =>
      `- ${p.name}\n    what makes them buy: ${p.pain}\n    already gathers at: ${
        p.where.join(", ") || "no named place found"
      }`,
  )
  .join("\n")}

THE NUMBER THIS PLAN MUST MOVE
North star: ${a.kpis.northStar.metric} - ${a.kpis.northStar.target}
${a.kpis.supporting.map((k) => `Also: ${k.metric} - ${k.target}`).join("\n")}`;
}

function buildPrompt(kit: BrandKit, signals: SiteSignals, goal: string, audience?: Audience | null): string {
  return `COMPANY: ${kit.name}
How they position themselves: ${kit.tagline}
Visual language: ${kit.imagery.style}

VOICE
tone: ${kit.voice.tone}
a real sentence from their site: "${kit.voice.sample}"
things they never do: ${kit.voice.avoid.map((a) => `\n  - ${a}`).join("")}

EVIDENCE - what we could actually observe about their marketing footprint
${describeSignals(signals)}

${audience ? describeAudience(audience) : ""}

${goal.trim() ? `WHAT THEY WANT OUT OF THIS\n${goal.trim()}\n` : ""}
Write the audit and plan.`;
}

export type StrategyResult = {
  plan: MarketingPlan;
  signals: SiteSignals;
  usedFallback: boolean;
  model: string;
  notes: string[];
  usage?: { input: number; output: number };
};

/**
 * Two jobs: force the model's free-text enum answers onto the real unions, and
 * fill in the fields we would rather measure than ask for.
 */
function coercePlan(draft: z.infer<typeof PlanDraftSchema>, signals: SiteSignals) {
  const maturities = ["invisible", "emerging", "active", "advanced"];
  const moves = ["start-here", "next", "later", "skip"];
  const norm = (v: string) => v.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const oneOf = (v: string, allowed: string[], fallback: string) =>
    allowed.includes(norm(v)) ? norm(v) : fallback;

  const linked = new Set(signals.socials.map((x) => x.platform.toLowerCase()));

  /**
   * Presence is evidence, so we derive it rather than trusting the model - it
   * called GitHub "absent" in testing while our own scan had just found the
   * link. A channel we have no way of seeing is "unverifiable", not "absent".
   */
  const presenceOf = (name: string): "linked" | "absent" | "unverifiable" => {
    const n = name.toLowerCase();
    const match = DETECTABLE_PLATFORMS.find(
      (p) => n.includes(p.toLowerCase()) || (p === "X" && /\btwitter\b|\bx\b/.test(n)),
    );
    if (!match) return "unverifiable";
    if (signals.degraded) return "unverifiable";
    return linked.has(match.toLowerCase()) ? "linked" : "absent";
  };

  const channels = draft.channels.slice(0, 4).map((c) => ({
    ...c,
    presence: presenceOf(c.name),
    move: oneOf(c.move, moves, "later"),
  }));

  // Exactly one start-here, so the UI can always point at a first move.
  const starters = channels.filter((c) => c.move === "start-here");
  if (starters.length === 0 && channels.length) channels[0].move = "start-here";
  if (starters.length > 1) starters.slice(1).forEach((c) => (c.move = "next"));

  return {
    audit: {
      ...draft.audit,
      maturity: oneOf(draft.audit.maturity, maturities, "emerging"),
      strengths: draft.audit.strengths.slice(0, 3),
      gaps: draft.audit.gaps.slice(0, 3),
    },
    channels,
    contentTypes: draft.contentTypes.slice(0, 3),
    experiments: draft.experiments.slice(0, 2),
    timeline: draft.timeline.slice(0, 3).map((t) => ({ ...t, deliverables: t.deliverables.slice(0, 3) })),
  };
}

export async function buildStrategy(
  kit: BrandKit,
  signals: SiteSignals,
  goal = "",
  audience?: Audience | null,
): Promise<StrategyResult> {
  const notes: string[] = [];

  if (!hasApiKey()) {
    return {
      plan: DEFAULT_MARKETING_PLAN,
      signals,
      usedFallback: true,
      model: STRATEGY_MODEL,
      notes: [MISSING_KEY_MESSAGE],
    };
  }

  const client = getClient();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildPrompt(kit, signals, goal, audience) },
  ];
  let usage: StrategyResult["usage"];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: STRATEGY_MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages,
        output_config: { format: zodOutputFormat(PlanDraftSchema) },
      });

      usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

      if (response.stop_reason === "refusal") {
        notes.push(`refused: ${response.stop_details?.category ?? "unknown"}`);
        break;
      }

      const draft = response.parsed_output;
      if (draft) {
        // Overproduction is paid for and then thrown away, so it is worth seeing.
        const over = [
          draft.channels.length > 4 && `channels ${draft.channels.length}`,
          draft.contentTypes.length > 3 && `contentTypes ${draft.contentTypes.length}`,
          draft.experiments.length > 2 && `experiments ${draft.experiments.length}`,
        ].filter(Boolean);
        if (over.length) notes.push(`model overproduced and we trimmed: ${over.join(", ")}`);

        const validated = MarketingPlanSchema.safeParse(coercePlan(draft, signals));
        if (validated.success) {
          return {
            plan: validated.data,
            signals,
            usedFallback: false,
            model: STRATEGY_MODEL,
            notes,
            usage,
          };
        }
        const issues = validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        notes.push(`attempt ${attempt + 1} failed validation: ${issues}`);
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: `That failed validation: ${issues}. Return it again, corrected.`,
        });
        continue;
      }

      notes.push(`attempt ${attempt + 1}: no parsable output`);
    } catch (err) {
      notes.push(`attempt ${attempt + 1} threw: ${String(err).slice(0, 300)}`);
      if (attempt === 1) break;
    }
  }

  return {
    plan: DEFAULT_MARKETING_PLAN,
    signals,
    usedFallback: true,
    model: STRATEGY_MODEL,
    notes,
    usage,
  };
}
