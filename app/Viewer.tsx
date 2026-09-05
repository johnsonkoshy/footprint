"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandKit, ContentSet, MarketingPlan, SiteSignals, TemplateId } from "@/types";
import {
  extract,
  generate,
  planStageFor,
  renderPng,
  stageFor,
  strategize,
  type Brief,
  type ExtractResponse,
} from "@/lib/client";
import { KitPanel } from "@/components/KitPanel";
import { PlanPanel } from "@/components/PlanPanel";

type Phase = "idle" | "extracting" | "ready" | "failed";
const STORE_KEY = "footprint:viewer";

export function Viewer() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Omit<ExtractResponse, "kit"> | null>(null);
  const [kit, setKit] = useState<BrandKit | null>(null);

  // The plan stage: audit their existing footprint, propose a strategy, and
  // wait for the user to approve it before anything gets written.
  const [signals, setSignals] = useState<SiteSignals | null>(null);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planElapsed, setPlanElapsed] = useState(0);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState("");
  const [topicIndex, setTopicIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [tab, setTab] = useState<"plan" | "post">("plan");
  const [brief, setBrief] = useState<Brief | undefined>(undefined);

  const [topic, setTopic] = useState("announcing a new integrations marketplace");
  const [content, setContent] = useState<ContentSet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("statement");

  const [publish, setPublish] = useState<{ configured: boolean; name: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

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
      if (s.signals) setSignals(s.signals);
      if (s.plan) setPlan(s.plan);
      if (s.channel) setChannel(s.channel);
      if (s.goal) setGoal(s.goal);
      if (s.brief) setBrief(s.brief);
      if (typeof s.topicIndex === "number") setTopicIndex(s.topicIndex);
      if (s.confirmed) {
        setConfirmed(true);
        setTab("post");
      }
    } catch {
      /* a corrupt cache is not worth a crash */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!kit) return;
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          url, kit, meta, content, topic, template,
          signals, plan, channel, goal, brief, topicIndex, confirmed,
        }),
      );
    } catch {
      /* quota or private mode - state just won't survive a refresh */
    }
  }, [url, kit, meta, content, topic, template, signals, plan, channel, goal, brief, topicIndex, confirmed]);

  useEffect(() => {
    fetch("/api/publish")
      .then((r) => r.json())
      .then(setPublish)
      .catch(() => setPublish({ configured: false, name: "Bluesky" }));
  }, []);

  useEffect(() => {
    if (!planning) return;
    const started = Date.now();
    const id = setInterval(() => setPlanElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [planning]);

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
    setPlan(null);
    setSignals(null);
    setPlanError(null);
    setConfirmed(false);
    setTab("plan");
    try {
      const { kit: k, ...rest } = await extract(url.trim());
      setKit(k);
      setMeta(rest);
      setPhase("ready");
      // The plan takes longer than the extraction did, so start it now - the
      // user reads the brand panel while it runs instead of waiting twice.
      runPlan(k, rest.signals, "");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setPhase("failed");
    }
  };

  const runPlan = useCallback(
    async (k: BrandKit, s: SiteSignals | null, g: string) => {
      setPlanning(true);
      setPlanElapsed(0);
      setPlanError(null);
      try {
        const res = await strategize(k, url.trim(), s, g);
        setPlan(res.plan);
        setSignals(res.signals);
        setPlanNotes(res.usedFallback ? res.notes : []);
        setChannel(res.plan.channels.find((c) => c.move === "start-here")?.name ?? "");
        setTopicIndex(0);
        setTopic(res.plan.contentTypes[0]?.topic ?? topic);
      } catch (err) {
        setPlanError(String(err instanceof Error ? err.message : err));
      } finally {
        setPlanning(false);
      }
    },
    // `topic` is only read as a fallback when the plan has no content types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url],
  );

  /** The gate the whole stage exists for: nothing is written until this runs. */
  const confirmPlan = () => {
    if (!plan) return;
    const picked = plan.channels.find((c) => c.name === channel);
    const next: Brief = {
      channel: picked?.name,
      format: plan.contentTypes[topicIndex]?.name,
      cadence: picked?.cadence,
    };
    setBrief(next);
    setConfirmed(true);
    setTab("post");
    runGenerate({ brief: next });
  };

  // Overrides exist because confirming a plan writes immediately, and React
  // state set in the same tick is not readable yet.
  const runGenerate = async (override?: { topic?: string; brief?: Brief }) => {
    const t = (override?.topic ?? topic).trim();
    if (!kit || !t) return;
    setGenerating(true);
    setRenderError(null);
    try {
      setContent(await generate(kit, t, override?.brief ?? brief));
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

  const sendPost = async () => {
    if (!imgUrl || !content) return;
    setPublishing(true);
    setRenderError(null);
    try {
      const blob = await fetch(imgUrl).then((r) => r.blob());
      const form = new FormData();
      form.append("image", blob, "post.png");
      form.append("text", content.caption || content.hook);
      const res = await fetch("/api/publish", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPublished(json.url);
    } catch (err) {
      setRenderError(String(err instanceof Error ? err.message : err));
    } finally {
      setPublishing(false);
    }
  };

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

      {/* ---------------- Right: the plan, then the post ---------------- */}
      <section className="flex flex-col gap-5">
        {kit ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex rounded-lg bg-zinc-100 p-0.5">
              {(["plan", "post"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  disabled={t === "post" && !confirmed}
                  className={`rounded-[6px] px-3 py-1.5 text-sm capitalize transition disabled:opacity-40 ${
                    tab === t ? "bg-white font-medium shadow-sm" : "text-zinc-500"
                  }`}
                >
                  {t === "plan" ? "Plan" : "Post"}
                </button>
              ))}
            </div>
            {confirmed && tab === "post" ? (
              <p className="truncate text-xs text-zinc-400">
                Writing {brief?.format ? `a ${brief.format.toLowerCase()}` : "a post"}
                {brief?.channel ? ` for ${brief.channel}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "plan" ? (
          planning ? (
            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{planStageFor(planElapsed)}</span>
                <span className="font-mono text-xs text-zinc-400">{planElapsed.toFixed(0)}s</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded bg-zinc-100">
                <div
                  className="h-full bg-zinc-900 transition-[width] duration-300"
                  style={{ width: `${Math.min(95, (planElapsed / 95) * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                We probe their blog, changelog and social links, then audit what we found. Around
                90 seconds — read the brand panel while it runs.
              </p>
            </div>
          ) : planError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
              <p className="font-medium text-red-800">Could not build a plan</p>
              <p className="mt-1 break-words text-red-700">{planError}</p>
              <button
                onClick={() => kit && runPlan(kit, signals, goal)}
                className="mt-3 text-sm font-medium text-red-800 underline"
              >
                Try again
              </button>
            </div>
          ) : plan && signals ? (
            <>
              {planNotes.length ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                  The plan fell back to a default. {planNotes.join("; ")}
                </p>
              ) : null}
              <PlanPanel
                plan={plan}
                signals={signals}
                goal={goal}
                onGoalChange={setGoal}
                onReplan={() => kit && runPlan(kit, signals, goal)}
                replanning={planning}
                channel={channel}
                onChannelChange={setChannel}
                topicIndex={topicIndex}
                onTopicIndexChange={(i) => {
                  setTopicIndex(i);
                  setTopic(plan.contentTypes[i]?.topic ?? topic);
                }}
                topic={topic}
                onTopicChange={setTopic}
                onConfirm={confirmPlan}
              />
            </>
          ) : (
            <div className="flex min-h-[400px] items-center justify-center rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-400 ring-1 ring-inset ring-zinc-200/70">
              <p className="max-w-xs">
                Extract a brand and we will audit the marketing they already have, then propose
                what to do next.
              </p>
            </div>
          )
        ) : null}

        {tab === "post" ? (
        <>
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

            {publish?.configured && imgUrl ? (
              <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3">
                <button
                  onClick={sendPost}
                  disabled={publishing}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                >
                  {publishing ? "Posting…" : `Post to ${publish.name}`}
                </button>
                {published ? (
                  <a
                    href={published}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm text-green-700 underline"
                  >
                    {published}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        </>
        ) : null}
      </section>
    </main>
  );
}
