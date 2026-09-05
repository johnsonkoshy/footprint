import Anthropic from "@anthropic-ai/sdk";
import { getClient, hasApiKey, MARKET_MODEL, MISSING_KEY_MESSAGE } from "@/lib/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  AudienceSchema,
  CompetitorsSchema,
  DEFAULT_AUDIENCE,
  DEFAULT_COMPETITORS,
  type Audience,
  type BrandKit,
  type Competitors,
  type SiteSignals,
} from "@/types";
import { describeSignals } from "@/lib/strategy/signals";

/**
 * Who buys this, who else sells it, and the one number that proves it works.
 *
 * Two calls, not one, because their costs are nothing alike. Audience is read
 * off the company's own copy and takes about 20 seconds. Competitors needs
 * live web search. A single combined call measured at 233 seconds; splitting
 * them and capping the search budget brought each under 30, and they run in
 * parallel so the whole stage costs about as long as the slower half.
 */

/** The reader is always the same person, so this is a constant, not a setting. */
const FOUNDER = `You are advising a very early stage founder. One or two people, no
marketing hire, a couple of hours a week, and no budget to speak of. That changes what
counts as a useful answer:

- They have no baseline, so a target expressed as a percentage change is meaningless.
  Every number you give is absolute and time-boxed: "30 customer conversations by week
  6", not "+15% conversations".
- They cannot run a campaign. They can send emails, show up in a place their buyers
  already are, and talk to people. Recommend things one person can do on a Tuesday.
- Reach is not their problem. Knowing exactly who to talk to is their problem.
- Do not congratulate them and do not soften. A founder would rather hear that their
  positioning is indistinguishable from three other companies than be encouraged.`;

const AUDIENCE_SYSTEM = `${FOUNDER}

You are reading a company's own homepage and the measured evidence of what marketing
they have built so far. From that, name their buyer, their position, and their number.

stage - judge it from the evidence, not from how polished the site looks.
"pre-launch" means nothing suggests a shipping product or a customer. "just-launched"
means the product is live but no analytics, no content, no audience. "early-traction"
means there are real signals: marketing tech running, content published, accounts
active. Be willing to say pre-launch.

positioning - one line, in their own register, that says who it is for and what makes
it different. If their homepage copy does not actually establish a difference, say
that in the line rather than inventing one.

icp - two, at most three. Each is a person you could picture, not a market segment.
"Solo ceramicist selling at weekend markets who dreads photographing inventory" is an
ICP. "Small businesses" is not. The "where" field is the most valuable thing you will
write: name actual places - a specific subreddit, a named Slack or Discord, a trade
show, a newsletter they read. If you do not know a real place, give fewer entries
rather than writing "social media" or "online communities".

kpis - one north star and two supporting. The north star is the single number that
tells this founder whether the thing is working at all, and at this stage it is almost
never revenue and almost never followers. Conversations, repeat usage, and people who
came back unprompted are the numbers that mean something before product-market fit.
For each, "why" says what they would do differently if it missed - if the answer is
"nothing", pick a different metric.`;

const COMPETITORS_SYSTEM = `${FOUNDER}

Research who else sells to this buyer. Run AT MOST TWO web searches, then answer
immediately - do not verify, cross-check, or keep searching for completeness. Speed
matters more than exhaustiveness here.

Every competitor must be one you actually saw in the search results, with the URL as it
appeared. Never reconstruct a URL from a company name you half-remember. If the searches
came back with nothing useful, return an empty list and explain why in "note" - a
founder can act on "we could not find anyone doing this, which is either an opening or a
warning" but is actively harmed by three plausible-sounding companies that do not exist.

theirEdge must be a real advantage, not a hedge. yourOpening is the gap a two-person
company could actually take: an underserved slice of the buyer, a job the incumbent does
badly, a register they cannot use. "Better UX" is not an opening.

Keep every field to one sentence.`;

function context(kit: BrandKit, signals: SiteSignals, siteText: string) {
  return `COMPANY: ${kit.name}
How they describe themselves: ${kit.tagline}
How they sound: ${kit.voice.tone}
A real sentence from their site: "${kit.voice.sample}"

WHAT WE MEASURED ABOUT THEIR MARKETING
${describeSignals(signals)}

THEIR HOMEPAGE COPY
${siteText.slice(0, 4000)}`;
}

export type AudienceResult = {
  audience: Audience;
  usedFallback: boolean;
  model: string;
  notes: string[];
  usage?: { input: number; output: number };
};

export type CompetitorsResult = {
  data: Competitors;
  usedFallback: boolean;
  model: string;
  notes: string[];
  searches: number;
  usage?: { input: number; output: number };
};

export async function readAudience(
  kit: BrandKit,
  signals: SiteSignals,
  siteText: string,
): Promise<AudienceResult> {
  const notes: string[] = [];
  if (!hasApiKey()) {
    return { audience: DEFAULT_AUDIENCE, usedFallback: true, model: MARKET_MODEL, notes: [MISSING_KEY_MESSAGE] };
  }

  const client = getClient();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `${context(kit, signals, siteText)}\n\nName their buyer, their position, and their number.` },
  ];
  let usage: AudienceResult["usage"];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: MARKET_MODEL,
        max_tokens: 8000,
        system: AUDIENCE_SYSTEM,
        messages,
        output_config: { format: zodOutputFormat(LooseAudience) },
      });
      usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

      if (response.stop_reason === "refusal") {
        notes.push(`refused: ${response.stop_details?.category ?? "unknown"}`);
        break;
      }

      const draft = response.parsed_output;
      if (draft) {
        const stages = ["pre-launch", "just-launched", "early-traction"];
        const stage = stages.includes(draft.stage) ? draft.stage : "just-launched";
        const validated = AudienceSchema.safeParse({
          ...draft,
          stage,
          icp: draft.icp.slice(0, 3).map((p) => ({ ...p, signals: p.signals.slice(0, 3), where: p.where.slice(0, 3) })),
          kpis: { ...draft.kpis, supporting: draft.kpis.supporting.slice(0, 2) },
        });
        if (validated.success) {
          return { audience: validated.data, usedFallback: false, model: MARKET_MODEL, notes, usage };
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
  return { audience: DEFAULT_AUDIENCE, usedFallback: true, model: MARKET_MODEL, notes, usage };
}

export async function findCompetitors(
  kit: BrandKit,
  siteText: string,
): Promise<CompetitorsResult> {
  const notes: string[] = [];
  if (!hasApiKey()) {
    return { data: DEFAULT_COMPETITORS, usedFallback: true, model: MARKET_MODEL, notes: [MISSING_KEY_MESSAGE], searches: 0 };
  }

  const client = getClient();
  let usage: CompetitorsResult["usage"];
  let searches = 0;

  // One attempt only. A retry means a second round of web searches, which costs
  // more time than the whole rest of the pipeline; the fallback says so instead.
  try {
    const response = await client.messages.parse({
      model: MARKET_MODEL,
      max_tokens: 4000,
      system: COMPETITORS_SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
      messages: [
        {
          role: "user",
          content: `${kit.name} (${kit.tagline}). Their site says: "${siteText.slice(0, 700)}"\n\nName up to 3 real competitors selling to the same buyer.`,
        },
      ],
      output_config: { format: zodOutputFormat(CompetitorsSchema) },
    });

    usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
    searches = response.usage.server_tool_use?.web_search_requests ?? 0;

    if (response.stop_reason === "refusal") {
      notes.push(`refused: ${response.stop_details?.category ?? "unknown"}`);
    } else if (response.parsed_output) {
      const validated = CompetitorsSchema.safeParse({
        ...response.parsed_output,
        competitors: response.parsed_output.competitors.slice(0, 3),
      });
      if (validated.success) {
        return { data: validated.data, usedFallback: false, model: MARKET_MODEL, notes, searches, usage };
      }
      notes.push(`failed validation: ${validated.error.issues.map((i) => i.message).join("; ")}`);
    } else {
      notes.push("no parsable output");
    }
  } catch (err) {
    notes.push(`threw: ${String(err).slice(0, 300)}`);
  }

  return { data: DEFAULT_COMPETITORS, usedFallback: true, model: MARKET_MODEL, notes, searches, usage };
}

/** Loose for the model, strict on the way back - same contract as every other stage. */
const LooseAudience = z.object({
  stage: z.string(),
  positioning: z.string(),
  icp: z.array(
    z.object({
      name: z.string(),
      signals: z.array(z.string()),
      pain: z.string(),
      where: z.array(z.string()),
    }),
  ),
  kpis: z.object({
    northStar: z.object({ metric: z.string(), target: z.string(), why: z.string() }),
    supporting: z.array(z.object({ metric: z.string(), target: z.string(), why: z.string() })),
  }),
});
