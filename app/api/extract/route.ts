import { NextResponse } from "next/server";
import { extractBrandKit } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/extract          -> one JSON body when everything is done
 * POST /api/extract?stream=1 -> NDJSON: a "capture" line as soon as the page is
 *                               photographed, then the "result" line
 *
 * The streamed form exists because the screenshot lands 15-30 seconds before
 * the audit does, and a screen that shows it immediately feels twice as fast
 * as one that waits. /compare and the scripts keep using the plain form.
 */
export async function POST(req: Request) {
  let url: string;
  try {
    ({ url } = await req.json());
    if (!url || typeof url !== "string") throw new Error("missing url");
  } catch {
    return NextResponse.json({ error: "Body must be { url: string }" }, { status: 400 });
  }

  const startedAt = Date.now();
  const stream = new URL(req.url).searchParams.get("stream") === "1";

  if (!stream) {
    try {
      const result = await extractBrandKit(url);
      return NextResponse.json({ ...result, ms: Date.now() - startedAt });
    } catch (err) {
      // extractBrandKit is meant not to throw; if it did, that's a bug worth seeing.
      return NextResponse.json({ error: String(err), ms: Date.now() - startedAt }, { status: 500 });
    }
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await extractBrandKit(url, {
          onCapture: (site, signals) => {
            send({
              type: "capture",
              url: site.url,
              title: site.title,
              screenshot: site.screenshot ? `data:image/png;base64,${site.screenshot}` : null,
              logo: site.logo,
              signals,
              degraded: site.degraded,
              ms: Date.now() - startedAt,
            });
          },
        });
        send({ type: "result", ...result, ms: Date.now() - startedAt });
      } catch (err) {
        send({ type: "error", error: String(err), ms: Date.now() - startedAt });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
