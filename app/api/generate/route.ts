import { NextResponse } from "next/server";
import { BrandKitSchema } from "@/types";
import { generateContent } from "@/lib/generate";
import { z } from "zod";

/** Optional: present only once the user has confirmed a plan. */
const BriefSchema = z.object({
  channel: z.string().optional(),
  format: z.string().optional(),
  cadence: z.string().optional(),
});

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { kit?: unknown; topic?: unknown; brief?: unknown; control?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const kit = BrandKitSchema.safeParse(body.kit);
  if (!kit.success) {
    return NextResponse.json(
      { error: `kit: ${kit.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` },
      { status: 400 },
    );
  }
  if (typeof body.topic !== "string" || !body.topic.trim()) {
    return NextResponse.json({ error: "topic must be a non-empty string" }, { status: 400 });
  }

  const startedAt = Date.now();
  const brief = BriefSchema.safeParse(body.brief);
  const result = await generateContent(
    kit.data,
    body.topic.trim(),
    brief.success ? brief.data : undefined,
    // The control is written blind, without the voice guide, so a founder can
    // see the difference between "a post about us" and "a post by us".
    { control: body.control === true },
  );
  return NextResponse.json({ ...result, ms: Date.now() - startedAt });
}
