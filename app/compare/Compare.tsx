"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandKit, ContentSet, TemplateId } from "@/types";
import { extract, generate, renderPng, stageFor } from "@/lib/client";
import { KitPanel } from "@/components/KitPanel";

type Side = {
  url: string;
  kit: BrandKit | null;
  content: ContentSet | null;
  img: string | null;
  status: "idle" | "extracting" | "writing" | "drawing" | "ready" | "failed";
  error: string | null;
  elapsed: number;
};

const blank = (url: string): Side => ({
  url,
  kit: null,
  content: null,
  img: null,
  status: "idle",
  error: null,
  elapsed: 0,
});

export function Compare() {
  const [left, setLeft] = useState<Side>(blank("stripe.com"));
  const [right, setRight] = useState<Side>(blank("notion.so"));
  const [topic, setTopic] = useState("announcing a new integrations marketplace");
  const [template, setTemplate] = useState<TemplateId>("statement");
  const [running, setRunning] = useState(false);
  const [chrome, setChrome] = useState(true);
  const objectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      objectUrls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );

  const track = (u: string) => {
    objectUrls.current.push(u);
    return u;
  };

  const runSide = useCallback(
    async (side: Side, set: (fn: (s: Side) => Side) => void, sharedTopic: string) => {
      const started = Date.now();
      const tick = setInterval(
        () => set((s) => ({ ...s, elapsed: (Date.now() - started) / 1000 })),
        250,
      );
      try {
        set((s) => ({ ...s, status: "extracting", error: null, img: null, content: null }));
        const { kit } = await extract(side.url.trim());
        set((s) => ({ ...s, kit, status: "writing" }));

        const content = await generate(kit, sharedTopic);
        set((s) => ({ ...s, content, status: "drawing" }));

        const img = track(await renderPng(kit, content, template));
        set((s) => ({ ...s, img, status: "ready" }));
      } catch (err) {
        set((s) => ({
          ...s,
          status: "failed",
          error: String(err instanceof Error ? err.message : err),
        }));
      } finally {
        clearInterval(tick);
      }
    },
    [template],
  );

  const run = async () => {
    setRunning(true);
    // Both sides in parallel - the whole point is that they finish together.
    await Promise.all([
      runSide(left, setLeft as never, topic.trim()),
      runSide(right, setRight as never, topic.trim()),
    ]);
    setRunning(false);
  };

  /** Instant demo: hand-written kits, no 40-second wait on stage. */
  const loadCached = async () => {
    setRunning(true);
    try {
      const { kits, content } = await fetch("/api/fixtures?content=1").then((r) => r.json());
      const build = async (name: string): Promise<Partial<Side>> => ({
        kit: kits[name],
        content: content[name],
        img: track(await renderPng(kits[name], content[name], template)),
        status: "ready",
        error: null,
      });
      const [l, r] = await Promise.all([build("stripe"), build("notion")]);
      setLeft((s) => ({ ...s, url: "stripe.com", ...l }) as Side);
      setRight((s) => ({ ...s, url: "notion.so", ...r }) as Side);
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      setLeft((s) => ({ ...s, status: "failed", error: msg }));
    } finally {
      setRunning(false);
    }
  };

  // Switching template re-renders whatever is already on screen.
  useEffect(() => {
    for (const [side, set] of [
      [left, setLeft],
      [right, setRight],
    ] as const) {
      if (side.kit && side.content && side.status === "ready") {
        renderPng(side.kit, side.content, template)
          .then((img) => set((s) => ({ ...s, img: track(img) })))
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  const busy = (s: Side) => ["extracting", "writing", "drawing"].includes(s.status);

  return (
    <main className="flex flex-1 flex-col bg-white">
      {chrome ? (
        <div className="border-b border-zinc-200">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 px-8 py-4">
            <input
              value={left.url}
              onChange={(e) => setLeft((s) => ({ ...s, url: e.target.value }))}
              className="w-44 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              placeholder="first url"
            />
            <span className="text-sm text-zinc-400">vs</span>
            <input
              value={right.url}
              onChange={(e) => setRight((s) => ({ ...s, url: e.target.value }))}
              className="w-44 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              placeholder="second url"
            />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-w-[220px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              placeholder="one topic, both brands"
            />
            <button
              onClick={run}
              disabled={running}
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {running ? "Running…" : "Generate both"}
            </button>
            <button
              onClick={loadCached}
              disabled={running}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:opacity-40"
              title="Hand-written kits, renders instantly - for demoing without the wait"
            >
              Instant pair
            </button>
            <div className="flex rounded-lg bg-zinc-100 p-0.5">
              {(["statement", "split"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={`rounded-[6px] px-3 py-1.5 text-sm capitalize ${
                    template === t ? "bg-white font-medium shadow-sm" : "text-zinc-500"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={() => setChrome(false)}
              className="ml-auto text-sm text-zinc-400 hover:text-zinc-900"
              title="Hide the controls for projecting"
            >
              Present ↗
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setChrome(true)}
          className="absolute right-4 top-3 z-10 text-xs text-zinc-300 hover:text-zinc-600"
        >
          controls
        </button>
      )}

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-10 p-8 lg:grid-cols-2">
        {[left, right].map((side, i) => (
          <div key={i} className="flex flex-col items-center gap-5">
            <div className="flex w-full max-w-[560px] items-center justify-center">
              {side.img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={side.img}
                  alt={`${side.url} post`}
                  className="w-full rounded-xl shadow-2xl ring-1 ring-black/5"
                />
              ) : (
                <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-xl bg-zinc-50 ring-1 ring-inset ring-zinc-200">
                  {busy(side) ? (
                    <>
                      <span className="text-sm font-medium text-zinc-700">
                        {side.status === "extracting"
                          ? stageFor(side.elapsed)
                          : side.status === "writing"
                            ? "Writing in their voice"
                            : "Rendering"}
                      </span>
                      <span className="font-mono text-xs text-zinc-400">
                        {side.elapsed.toFixed(0)}s
                      </span>
                    </>
                  ) : side.status === "failed" ? (
                    <p className="max-w-xs px-6 text-center text-sm text-red-700">{side.error}</p>
                  ) : (
                    <span className="text-sm text-zinc-400">{side.url || "no url"}</span>
                  )}
                </div>
              )}
            </div>

            {side.kit ? (
              <div className="w-full max-w-[560px]">
                <KitPanel kit={side.kit} compact />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
