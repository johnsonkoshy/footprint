import { NextResponse } from "next/server";
import { BrandKitSchema } from "@/types";
import { generateContent } from "@/lib/generate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { kit?: unknown; topic?: unknown };
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
  const result = await generateContent(kit.data, body.topic.trim());
  return NextResponse.json({ ...result, ms: Date.now() - startedAt });
}
