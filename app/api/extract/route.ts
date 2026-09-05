import { NextResponse } from "next/server";
import { extractBrandKit } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let url: string;
  try {
    ({ url } = await req.json());
    if (!url || typeof url !== "string") throw new Error("missing url");
  } catch {
    return NextResponse.json({ error: "Body must be { url: string }" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const result = await extractBrandKit(url);
    return NextResponse.json({ ...result, ms: Date.now() - startedAt });
  } catch (err) {
    // extractBrandKit is meant not to throw; if it did, that's a bug worth seeing.
    return NextResponse.json(
      { error: String(err), ms: Date.now() - startedAt },
      { status: 500 },
    );
  }
}
