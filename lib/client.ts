import type { BrandKit, ContentSet, MarketingPlan, SiteSignals, TemplateId } from "@/types";

/** Shared browser-side calls. Kept out of components so /compare can reuse them. */

export type ExtractResponse = {
  kit: BrandKit;
  signals: SiteSignals;
  usedFallback: boolean;
  degraded: boolean;
  fonts: { display: { requested: string; google: string }; body: { requested: string; google: string } };
  notes: string[];
  ms: number;
};

export async function extract(url: string): Promise<ExtractResponse> {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Extraction failed (${res.status})`);
  return json;
}

export type Brief = { channel?: string; format?: string; cadence?: string };

export async function generate(
  kit: BrandKit,
  topic: string,
  brief?: Brief,
): Promise<ContentSet> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kit, topic, brief }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`);
  return json.content;
}

export type StrategyResponse = {
  plan: MarketingPlan;
  signals: SiteSignals;
  usedFallback: boolean;
  model: string;
  notes: string[];
  ms: number;
  probeMs: number;
};

export async function strategize(
  kit: BrandKit,
  url: string,
  signals: SiteSignals | null,
  goal = "",
): Promise<StrategyResponse> {
  const res = await fetch("/api/strategy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kit, url, signals, goal }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Strategy failed (${res.status})`);
  return json;
}

/** Returns an object URL for the rendered PNG. Caller revokes it. */
export async function renderPng(
  kit: BrandKit,
  content: ContentSet,
  template: TemplateId,
): Promise<string> {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kit, content, template }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Render failed (${res.status})`);
  }
  return URL.createObjectURL(await res.blob());
}

/** Measured on the ten test URLs: capture lands 3-6s in, the audit runs 15-35s. */
export const EXTRACT_STAGES = [
  { at: 0, label: "Opening the homepage" },
  { at: 3, label: "Screenshotting" },
  { at: 7, label: "Reading the copy" },
  { at: 12, label: "Auditing the brand" },
  { at: 28, label: "Still auditing - some sites take a while" },
] as const;

export function stageFor(elapsedSeconds: number): string {
  let label: string = EXTRACT_STAGES[0].label;
  for (const s of EXTRACT_STAGES) if (elapsedSeconds >= s.at) label = s.label;
  return label;
}

/** Measured: probes land ~1.5s in, the plan itself runs 60-95s on Sonnet. */
export const PLAN_STAGES = [
  { at: 0, label: "Checking their marketing surfaces" },
  { at: 3, label: "Reading the footprint" },
  { at: 8, label: "Auditing where they stand" },
  { at: 35, label: "Writing the plan" },
  { at: 80, label: "Still writing - this one is thorough" },
] as const;

export function planStageFor(elapsedSeconds: number): string {
  let label: string = PLAN_STAGES[0].label;
  for (const s of PLAN_STAGES) if (elapsedSeconds >= s.at) label = s.label;
  return label;
}
