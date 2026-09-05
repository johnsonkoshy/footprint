import { NextResponse } from "next/server";
import { BrandKitSchema } from "@/types";
import { findCompetitors } from "@/lib/market";

export const runtime = "nodejs";
// Web search makes this the longest call in the app, so it gets the most room.
export const maxDuration = 180;

export async function POST(req: Request) {
  let body: { kit?: unknown; text?: unknown };
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

  const startedAt = Date.now();
  const result = await findCompetitors(kit.data, typeof body.text === "string" ? body.text : "");
  return NextResponse.json({ ...result, ms: Date.now() - startedAt });
}
