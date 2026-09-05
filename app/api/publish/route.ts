import { NextResponse } from "next/server";
import { bluesky } from "@/lib/publish/bluesky";

export const runtime = "nodejs";

/** GET tells the UI whether to show the button at all. */
export async function GET() {
  return NextResponse.json({ configured: bluesky.isConfigured(), name: bluesky.name });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const image = form?.get("image");
  const text = form?.get("text");

  if (!(image instanceof Blob) || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Send multipart form data with image and text" }, { status: 400 });
  }

  try {
    const result = await bluesky.publish(Buffer.from(await image.arrayBuffer()), text);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
