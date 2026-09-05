import { NextResponse } from "next/server";
import { BrandKitSchema, SiteSignalsSchema, EMPTY_SIGNALS } from "@/types";
import { readAudience } from "@/lib/market";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { kit?: unknown; signals?: unknown; text?: unknown };
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

  const signals = SiteSignalsSchema.safeParse(body.signals);
  const startedAt = Date.now();
  const result = await readAudience(
    kit.data,
    signals.success ? signals.data : EMPTY_SIGNALS,
    typeof body.text === "string" ? body.text : "",
  );
  return NextResponse.json({ ...result, ms: Date.now() - startedAt });
}
