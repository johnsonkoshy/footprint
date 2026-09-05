import { NextResponse } from "next/server";
import { BrandKitSchema, SiteSignalsSchema, EMPTY_SIGNALS } from "@/types";
import { probeSurfaces } from "@/lib/strategy/signals";
import { buildStrategy } from "@/lib/strategy";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { kit?: unknown; url?: unknown; signals?: unknown; goal?: unknown };
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
  if (typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "url must be a non-empty string" }, { status: 400 });
  }

  // Signals are optional: extraction hands them over for free, but the route
  // works standalone by reading the site itself.
  const parsed = SiteSignalsSchema.safeParse(body.signals);
  const startedAt = Date.now();

  const signals = await probeSurfaces(body.url.trim(), parsed.success ? parsed.data : EMPTY_SIGNALS);
  const probedAt = Date.now();

  const result = await buildStrategy(
    kit.data,
    signals,
    typeof body.goal === "string" ? body.goal : "",
  );

  return NextResponse.json({
    ...result,
    ms: Date.now() - startedAt,
    probeMs: probedAt - startedAt,
  });
}
