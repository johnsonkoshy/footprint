"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandKit, ContentSet, TemplateId } from "@/types";
import { extract, generate, renderPng, stageFor, type ExtractResponse } from "@/lib/client";
import { KitPanel } from "@/components/KitPanel";

type Phase = "idle" | "extracting" | "ready" | "failed";
const STORE_KEY = "footprint:viewer";

export function Viewer() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Omit<ExtractResponse, "kit"> | null>(null);
  const [kit, setKit] = useState<BrandKit | null>(null);

  const [topic, setTopic] = useState("announcing a new integrations marketplace");
  const [content, setContent] = useState<ContentSet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("statement");

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const lastImg = useRef<string | null>(null);

  // Convex is the intended store (convex/kits.ts is written and waiting on a
  // login). Until then sessionStorage keeps a refresh from losing 40s of work.
  useEffect(() => {
    // Rehydrating from browser storage has to happen after mount - the server
    // has no sessionStorage, so doing it during render breaks hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.kit) {
        setKit(s.kit);
        setMeta(s.meta ?? null);
        setUrl(s.url ?? "");
        setPhase("ready");
      }
      if (s.content) setContent(s.content);
      if (s.topic) setTopic(s.topic);
      if (s.template) setTemplate(s.template);
    } catch {
      /* a corrupt cache is not worth a crash */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!kit) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ url, kit, meta, content, topic, template }));
    } catch {
      /* quota or private mode - state just won't survive a refresh */
    }
  }, [url, kit, meta, content, topic, template]);

  useEffect(() => {
    if (phase !== "extracting") return;
    const started = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [phase]);

  const runExtract = async () => {
    if (!url.trim()) return;
    setPhase("extracting");
    setElapsed(0);
    setError(null);
    setContent(null);
    setImgUrl(null);
    try {
      const { kit: k, ...rest } = await extract(url.trim());
      setKit(k);
      setMeta(rest);
      setPhase("ready");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setPhase("failed");
    }
  };

  const runGenerate = async () => {
    if (!kit || !topic.trim()) return;
    setGenerating(true);
    try {
      setContent(await generate(kit, topic.trim()));
    } catch (err) {
      setRenderError(String(err instanceof Error ? err.message : err));
    } finally {
      setGenerating(false);
    }
  };

  // Re-render whenever the kit, the copy, or the template changes.
  const draw = useCallback(async () => {
    if (!kit || !content) return;
    setRendering(true);
    setRenderError(null);
    try {
      const next = await renderPng(kit, content, template);
      if (lastImg.current) URL.revokeObjectURL(lastImg.current);
      lastImg.current = next;
      setImgUrl(next);
    } catch (err) {
      setRenderError(String(err instanceof Error ? err.message : err));
    } finally {
      setRendering(false);
    }
  }, [kit, content, template]);

  useEffect(() => {
    const id = setTimeout(draw, 220); // debounce live edits
    return () => clearTimeout(id);
  }, [draw]);

  return (
    <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-10 p-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {/* ---------------- Left: the brand ---------------- */}
      <section className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Footprint</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Paste a URL. We read their identity and write in their voice.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runExtract();
          }}
          className="flex gap-2"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="stripe.com"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <button
            type="submit"
            disabled={phase === "extracting" || !url.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {phase === "extracting" ? "Reading…" : "Extract"}
          </button>
        </form>

        {phase === "extracting" ? (
          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{stageFor(elapsed)}</span>
              <span className="font-mono text-xs text-zinc-400">{elapsed.toFixed(0)}s</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded bg-zinc-100">
              <div
                className="h-full bg-zinc-900 transition-[width] duration-300"
                style={{ width: `${Math.min(95, (elapsed / 35) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Typically 20–40 seconds. We screenshot the homepage, read the copy, then audit both.
            </p>
          </div>
        ) : null}

        {phase === "failed" ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
            <p className="font-medium text-red-800">Could not read that site</p>
            <p className="mt-1 break-words text-red-700">{error}</p>
            <button onClick={runExtract} className="mt-3 text-sm font-medium text-red-800 underline">
              Try again
            </button>
          </div>
        ) : null}

        {phase === "idle" && !kit ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
            <p className="font-medium text-zinc-700">Nothing loaded yet</p>
            <p className="mt-1">
              Try{" "}
              {["stripe.com", "notion.so", "craigslist.org"].map((u, i) => (
                <span key={u}>
                  {i > 0 ? ", " : ""}
                  <button onClick={() => setUrl(u)} className="underline hover:text-zinc-900">
                    {u}
                  </button>
                </span>
              ))}
              .
            </p>
          </div>
        ) : null}

        {kit ? (
          <>
            {meta?.usedFallback ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                Extraction fell back to a neutral kit. {meta.notes.join("; ")}
              </p>
            ) : meta?.degraded ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                No screenshot — this site blocked our browser, so the palette is a guess.
              </p>
            ) : null}
            <KitPanel kit={kit} fonts={meta?.fonts} onChange={setKit} />
            <p className="text-xs text-zinc-400">Click any swatch to override it. The image redraws live.</p>
          </>
        ) : null}
      </section>

      {/* ---------------- Right: the post ---------------- */}
      <section className="flex flex-col gap-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runGenerate();
          }}
          className="flex gap-2"
        >
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What is the post about?"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <button
            type="submit"
            disabled={!kit || generating || !topic.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {generating ? "Writing…" : "Generate"}
          </button>
        </form>

        {content ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg bg-zinc-100 p-0.5">
              {(["statement", "split"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={`rounded-[6px] px-3 py-1.5 text-sm capitalize transition ${
                    template === t ? "bg-white shadow-sm font-medium" : "text-zinc-500"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              value={content.hook}
              onChange={(e) => setContent({ ...content, hook: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-zinc-50 px-3 py-2 text-sm hover:border-zinc-300 focus:border-zinc-900 focus:bg-white focus:outline-none"
              aria-label="Headline"
            />
            {rendering ? <span className="text-xs text-zinc-400">rendering…</span> : null}
          </div>
        ) : null}

        <div className="flex min-h-[540px] items-start justify-center rounded-xl bg-zinc-50 p-6 ring-1 ring-inset ring-zinc-200/70">
          {renderError ? (
            <p className="max-w-md self-center text-center text-sm text-red-700">{renderError}</p>
          ) : imgUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imgUrl}
              alt="Rendered post"
              className="max-h-[76vh] w-auto rounded-lg shadow-xl ring-1 ring-black/5"
            />
          ) : (
            <p className="max-w-xs self-center text-center text-sm text-zinc-400">
              {kit
                ? "Enter a topic and hit Generate."
                : "Extract a brand first, then write a post in their voice."}
            </p>
          )}
        </div>

        {content ? (
          <div className="rounded-lg border border-zinc-200 p-4 text-sm">
            <p className="text-zinc-700">{content.caption}</p>
            <p className="mt-2 text-zinc-400">{content.hashtags.map((h) => `#${h}`).join(" ")}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
