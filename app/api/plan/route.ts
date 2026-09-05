import { NextResponse } from "next/server";
import { AudienceSchema, BrandKitSchema, MarketingPlanSchema } from "@/types";
import { rebuildPlan } from "@/lib/strategy/rebuild";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = MarketingPlanSchema.omit({ audit: true });

export async function POST(req: Request) {
  let body: {
    kit?: unknown; audience?: unknown; channels?: unknown;
    formats?: unknown; goal?: unknown; previous?: unknown;
  };
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
  const previous = Body.safeParse(body.previous);
  if (!previous.success) {
    return NextResponse.json({ error: "previous must be a plan body" }, { status: 400 });
  }

  const channels = Array.isArray(body.channels) ? body.channels.filter((c): c is string => typeof c === "string") : [];
  const formats = Array.isArray(body.formats) ? body.formats.filter((f): f is string => typeof f === "string") : [];
  if (!channels.length) return NextResponse.json({ error: "Pick at least one channel" }, { status: 400 });
  if (!formats.length) return NextResponse.json({ error: "Pick at least one format" }, { status: 400 });

  const audience = AudienceSchema.safeParse(body.audience);
  const startedAt = Date.now();
  const result = await rebuildPlan(
    kit.data,
    audience.success ? audience.data : null,
    channels,
    formats,
    typeof body.goal === "string" ? body.goal : "",
    previous.data,
  );
  return NextResponse.json({ ...result, ms: Date.now() - startedAt });
}
