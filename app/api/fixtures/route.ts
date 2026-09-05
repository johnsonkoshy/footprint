import { NextResponse } from "next/server";
import { FIXTURE_KITS, FIXTURE_CONTENT } from "@/lib/render/fixtures";

/** Hand-written kits, so the demo can preload without waiting on extraction. */
export async function GET(req: Request) {
  const withContent = new URL(req.url).searchParams.has("content");
  return NextResponse.json(withContent ? { kits: FIXTURE_KITS, content: FIXTURE_CONTENT } : FIXTURE_KITS);
}
