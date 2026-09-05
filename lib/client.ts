import type { BrandKit, ContentSet, TemplateId } from "@/types";

/** Shared browser-side calls. Kept out of components so /compare can reuse them. */

export type ExtractResponse = {
  kit: BrandKit;
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

export async function generate(kit: BrandKit, topic: string): Promise<ContentSet> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kit, topic }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`);
  return json.content;
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
