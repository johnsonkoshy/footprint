"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Audience,
  BrandKit,
  Competitors,
  ContentSet,
  MarketingPlan,
  SiteSignals,
  TemplateId,
} from "@/types";
import {
  extractStream,
  findCompetitors,
  generate,
  readAudience,
  rebuildPlan,
  renderPng,
  strategize,
  type Brief,
  type CaptureEvent,
  type ExtractResponse,
} from "@/lib/client";
import { planBodyOf } from "@/lib/strategy/rebuild";
import { BrandStage } from "@/components/stages/BrandStage";
import { FootprintStage } from "@/components/stages/FootprintStage";
import { MarketStage } from "@/components/stages/MarketStage";
import { PlanStage } from "@/components/stages/PlanStage";
import { PostStage } from "@/components/stages/PostStage";
import { Canvas } from "@/components/Canvas";
import type { StageStatus } from "@/components/stages/Stage";

/**
 * Story on the left, artifact on the right. The left column is the process
 * unfolding top to bottom - Brand, Footprint, Plan, Post - and each card shows
 * what it has the moment it has it. The right column is one canvas that
 * evolves: what we make, then their homepage, then their post.
 */

type Phase = "idle" | "capturing" | "auditing" | "ready" | "failed";
const STORE_KEY = "footprint:viewer";

const STEPS = ["Brand", "Market", "Plan", "Post"] as const;

/** One definition of "we advise this", used to seed the picks and to test them. */
const isRecommended = (c: { move: string }) => c.move === "start-here" || c.move === "next";

export function Viewer() {
  const params = useSearchParams();
  const [url, setUrl] = useState(params.get("url") ?? "");
  /** null means "follow the work"; a number means the user chose this step. */
  const [pinnedStep, setPinnedStep] = useState<number | null>(null);
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // What the page gave us at ~6s, before the model has said anything.
  const [capture, setCapture] = useState<CaptureEvent | null>(null);
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [meta, setMeta] = useState<Omit<ExtractResponse, "kit"> | null>(null);

  const [signals, setSignals] = useState<SiteSignals | null>(null);
  const [siteText, setSiteText] = useState("");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [audienceWorking, setAudienceWorking] = useState(false);
  const [marketElapsed, setMarketElapsed] = useState(0);
  const [competitors, setCompetitors] = useState<Competitors | null>(null);
  const [competitorsWorking, setCompetitorsWorking] = useState(false);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planElapsed, setPlanElapsed] = useState(0);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState("");
  const [topicIndex, setTopicIndex] = useState(0);
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState<Brief | undefined>(undefined);
  // What the founder has ticked. Seeded from the plan's own recommendation, so
  // accepting our advice costs zero clicks and overriding it costs one.
  const [pickedChannels, setPickedChannels] = useState<string[]>([]);
  const [pickedFormats, setPickedFormats] = useState<string[]>([]);
  const [rebuilding, setRebuilding] = useState(false);

  const [content, setContent] = useState<ContentSet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("statement");

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const lastImg = useRef<string | null>(null);

  const [publish, setPublish] = useState<{ configured: boolean; name: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  // ---------- persistence: a refresh must not cost a minute ----------
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (!s.kit) return;
      // Arriving from the landing page for a different company must not resume
      // the last one just because its kit is still in storage.
      const incoming = params.get("url")?.trim();
      if (incoming && s.url && s.url.trim() !== incoming) return;
      setKit(s.kit);
      setMeta(s.meta ?? null);
      setUrl(s.url ?? "");
      setCapture(s.capture ?? null);
      setSignals(s.signals ?? null);
      setPlan(s.plan ?? null);
      setChannel(s.channel ?? "");
      setGoal(s.goal ?? "");
      setBrief(s.brief ?? undefined);
      setTopicIndex(typeof s.topicIndex === "number" ? s.topicIndex : 0);
      setTopic(s.topic ?? "");
      setContent(s.content ?? null);
      setTemplate(s.template ?? "statement");
      // Without these the restored plan renders with nothing ticked, which
      // reads as "pick at least one channel" on a plan that already has some -
      // and the save effect then writes the empty picks back over the good ones.
      if (s.plan) {
        setPickedChannels(
          s.pickedChannels?.length ? s.pickedChannels : s.plan.channels.filter(isRecommended).map((c: { name: string }) => c.name),
        );
        setPickedFormats(
          s.pickedFormats?.length ? s.pickedFormats : s.plan.contentTypes.map((c: { name: string }) => c.name),
        );
      }
      setPhase("ready");
    } catch {
      /* a corrupt cache is not worth a crash */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // params is read to scope the restore to the requested company; it is
    // stable for the life of the page, so this still runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!kit) return;
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          url, kit, meta, capture, signals, siteText, audience, competitors,
          plan, channel, goal, brief, topicIndex, topic, content, template,
          pickedChannels, pickedFormats,
        }),
      );
    } catch {
      /* quota or private mode - state just won't survive a refresh */
    }
  }, [url, kit, meta, capture, signals, siteText, audience, competitors, plan, channel, goal, brief, topicIndex, topic, content, template, pickedChannels, pickedFormats]);

  useEffect(() => {
    fetch("/api/publish")
      .then((r) => r.json())
      .then(setPublish)
      .catch(() => setPublish({ configured: false, name: "Bluesky" }));
  }, []);

  // ---------- clocks ----------
  const extracting = phase === "capturing" || phase === "auditing";
  useEffect(() => {
    if (!extracting) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [extracting]);

  useEffect(() => {
    if (!audienceWorking) return;
    const started = Date.now();
    const id = setInterval(() => setMarketElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [audienceWorking]);

  useEffect(() => {
    if (!planning) return;
    const started = Date.now();
    const id = setInterval(() => setPlanElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [planning]);

  // ---------- the process ----------
  const runPlan = useCallback(
    async (k: BrandKit, s: SiteSignals | null, g: string, a?: Audience | null) => {
      setPlanning(true);
      setPlanElapsed(0);
      setPlanError(null);
      try {
        const res = await strategize(k, url.trim(), s, g, a);
        setPlan(res.plan);
        setSignals(res.signals);
        setPlanNotes(res.usedFallback ? res.notes : []);
        setChannel(res.plan.channels.find((c) => c.move === "start-here")?.name ?? "");
        setPickedChannels(res.plan.channels.filter(isRecommended).map((c) => c.name));
        setPickedFormats(res.plan.contentTypes.map((c) => c.name));
        setTopicIndex(0);
        setTopic(res.plan.contentTypes[0]?.topic ?? "");
      } catch (err) {
        setPlanError(String(err instanceof Error ? err.message : err));
      } finally {
        setPlanning(false);
      }
    },
    [url],
  );

  const runExtract = async (raw?: string) => {
    const target = (raw ?? url).trim();
    if (!target) return;
    setUrl(target);
    setPhase("capturing");
    setElapsed(0);
    setError(null);
    setCapture(null);
    setKit(null);
    setMeta(null);
    setSignals(null);
    setAudience(null);
    setCompetitors(null);
    setPlan(null);
    setPlanError(null);
    setBrief(undefined);
    setContent(null);
    setImgUrl(null);
    setPublished(null);
    setPinnedStep(null);
    try {
      const { kit: k, ...rest } = await extractStream(target, (c) => {
        setCapture(c);
        setSignals(c.signals);
        setPhase("auditing");
      });
      setKit(k);
      setMeta(rest);
      setSiteText(rest.text);
      setPhase("ready");
      runMarket(k, rest.signals, rest.text);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setPhase("failed");
    }
  };

  /**
   * Both halves of the market read fire together, and the plan waits only on
   * the fast one. Competitor research runs live web searches and is the
   * longest call in the app; nothing downstream needs it, so it is allowed to
   * land whenever it lands.
   */
  const runMarket = useCallback(
    (k: BrandKit, s: SiteSignals, text: string) => {
      setAudienceWorking(true);
      setMarketElapsed(0);
      setCompetitorsWorking(true);
      setAudience(null);
      setCompetitors(null);

      readAudience(k, s, text)
        .then((res) => {
          setAudience(res.audience);
          runPlan(k, s, "", res.audience);
        })
        .catch(() => runPlan(k, s, "", null))
        .finally(() => setAudienceWorking(false));

      findCompetitors(k, text)
        .then((res) => setCompetitors(res.data))
        .catch((err) =>
          setCompetitors({ competitors: [], note: `Couldn't research the field. ${String(err instanceof Error ? err.message : err)}` }),
        )
        .finally(() => setCompetitorsWorking(false));
    },
    [runPlan],
  );

  const runRebuild = async () => {
    if (!kit || !plan || !pickedChannels.length || !pickedFormats.length) return;
    setRebuilding(true);
    setPlanError(null);
    try {
      const previous = planBodyOf(plan);
      const res = await rebuildPlan({
        kit,
        audience,
        // Send them in the plan's own order so "first" means something.
        channels: plan.channels.filter((c) => pickedChannels.includes(c.name)).map((c) => c.name),
        formats: plan.contentTypes.filter((c) => pickedFormats.includes(c.name)).map((c) => c.name),
        goal,
        previous,
      });
      const next = { audit: plan.audit, ...res.plan };
      setPlan(next);
      setPlanNotes(res.usedFallback ? res.notes : []);
      setPickedChannels(next.channels.map((c) => c.name));
      setPickedFormats(next.contentTypes.map((c) => c.name));
      setChannel(next.channels[0]?.name ?? "");
      setTopicIndex(0);
      setTopic(next.contentTypes[0]?.topic ?? "");
    } catch (err) {
      setPlanError(String(err instanceof Error ? err.message : err));
    } finally {
      setRebuilding(false);
    }
  };

  /**
   * Arriving from the landing page with ?url= starts the run on mount. The ref
   * guard is what keeps a re-render from extracting the same site twice.
   */
  useEffect(() => {
    const incoming = params.get("url");
    if (!incoming || started.current) return;
    started.current = true;
    // `kit` is still null in this closure even when the restore effect above
    // just set it - both effects run in the same commit. Ask storage instead,
    // or a refresh silently pays for the whole extraction again.
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "{}");
      if (saved.kit && saved.url?.trim() === incoming.trim()) return;
    } catch {
      /* unreadable cache just means we extract, which is the safe direction */
    }
    // Kicking off the run is the whole job of this effect, and runExtract sets
    // phase synchronously so the loading state paints on the first frame. The
    // cascade the rule guards against is the point here, once, on mount.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    runExtract(incoming);
    // runExtract is recreated every render; the ref guard above is what makes
    // this run once, so depending on it would defeat the guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const runGenerate = async (override?: { brief?: Brief }) => {
    const t = topic.trim();
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

  /** Choosing a brief and pressing the button is the approval. Nothing is written before this. */
  const writePost = () => {
    if (!plan) return;
    const picked = plan.channels.find((c) => c.name === effectiveChannel);
    const next: Brief = { channel: picked?.name, format: plan.contentTypes[topicIndex]?.name, cadence: picked?.cadence };
    setBrief(next);
    runGenerate({ brief: next });
    setPinnedStep(3);
  };

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
    const id = setTimeout(draw, 220);
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

  // ---------- derived ----------
  const brandStatus: StageStatus =
    phase === "failed" ? "error" : extracting ? "working" : kit ? "done" : "pending";
  const footprintStatus: StageStatus =
    plan ? "done" : signals || extracting ? "working" : "pending";
  const marketStatus: StageStatus =
    audience ? "done" : audienceWorking ? "working" : "pending";
  const planStatus: StageStatus =
    planError ? "error" : plan ? "done" : planning ? "working" : "pending";
  const postStatus: StageStatus = content ? "done" : generating ? "working" : "pending";

  /**
   * The plan on screen was written for a different selection than the one
   * ticked. This predicate must match the one that seeds the selection in
   * runPlan - when they disagreed, a plan containing a "later" channel showed
   * as dirty the instant it arrived, before anyone had touched a thing.
   */
  const planChannels = plan?.channels.filter(isRecommended).map((c) => c.name) ?? [];
  const planFormats = plan?.contentTypes.map((c) => c.name) ?? [];
  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x) => b.includes(x));
  const selectionDirty =
    Boolean(plan) && !(sameSet(pickedChannels, planChannels) && sameSet(pickedFormats, planFormats));

  /**
   * Unticking the channel we were about to write for would otherwise leave the
   * button naming a channel the founder just rejected. Derived rather than
   * synced in an effect - there is no second render and nothing to get stale.
   */
  const effectiveChannel = pickedChannels.includes(channel) ? channel : (pickedChannels[0] ?? "");

  const canvasMode = imgUrl || content ? "post" : capture?.screenshot ? "screenshot" : "empty";

  const furthest = content ? 3 : plan ? 2 : audience ? 1 : 0;
  const ready = [Boolean(kit), Boolean(audience), Boolean(plan), Boolean(content)];

  /**
   * The view follows the work forward on its own until the user navigates, and
   * then stays where they put it. Derived rather than synced in an effect, so
   * there is no second render and no moment where the two disagree.
   */
  const step = pinnedStep ?? furthest;

  const goto = (i: number) => setPinnedStep(Math.max(0, Math.min(STEPS.length - 1, i)));

  const primary = (() => {
    if (step === 2 && plan) {
      return {
        label: generating ? "Writing…" : `Write this post for ${effectiveChannel || "them"}`,
        onClick: writePost,
        disabled: generating || !topic.trim() || !pickedChannels.length,
      };
    }
    if (step < 3 && ready[step + 1]) {
      return { label: `Next: ${STEPS[step + 1]}`, onClick: () => goto(step + 1), disabled: false };
    }
    if (step === 3 && content) {
      return { label: "Write another", onClick: () => goto(2), disabled: false };
    }
    return null;
  })();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* ---------------- header: identity, progress, escape ---------------- */}
      <header className="shrink-0 border-b border-zinc-200">
        <div className="mx-auto flex w-full max-w-[1500px] items-center gap-6 px-6 py-3">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">
            Footprint
          </Link>

          <ol className="flex min-w-0 flex-1 items-center gap-1">
            {STEPS.map((label, i) => {
              const state = ready[i] ? "done" : i === furthest ? "now" : "todo";
              const reachable = ready[i] || i <= furthest;
              return (
                <li key={label} className="flex min-w-0 items-center">
                  {i > 0 ? <span aria-hidden className="mx-1 h-px w-4 shrink-0 bg-zinc-200 sm:w-8" /> : null}
                  <button
                    onClick={() => reachable && goto(i)}
                    disabled={!reachable}
                    aria-current={step === i ? "step" : undefined}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition ${
                      step === i
                        ? "bg-zinc-900 text-white"
                        : reachable
                          ? "text-zinc-600 hover:bg-zinc-100"
                          : "text-zinc-300"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        state === "done"
                          ? step === i
                            ? "bg-white"
                            : "bg-zinc-900"
                          : state === "now"
                            ? "animate-pulse bg-amber-500"
                            : "bg-zinc-300"
                      }`}
                    />
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>

          <span className="hidden min-w-0 shrink truncate text-sm text-zinc-400 sm:block">{url}</span>
          <Link href="/" className="shrink-0 text-sm text-zinc-500 hover:text-zinc-900">
            Start over
          </Link>
        </div>
      </header>

      {/* ---------------- body: one step, one canvas, no page scroll ---------------- */}
      <main className="mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 grid-cols-1 gap-8 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* min-h-0 is what lets this column scroll instead of stretching the page. */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          {step === 0 ? (
            <BrandStage
              status={brandStatus}
              elapsed={elapsed}
              screenshot={capture?.screenshot ?? null}
              siteTitle={capture?.title ?? null}
              kit={kit}
              fonts={meta?.fonts}
              notes={
                phase === "failed"
                  ? [error ?? ""]
                  : meta?.usedFallback
                    ? ["Extraction fell back to a neutral kit.", ...meta.notes]
                    : meta?.degraded
                      ? ["This site blocked our browser, so the palette is a guess."]
                      : []
              }
              onChange={setKit}
            />
          ) : null}

          {step === 1 ? (
            <>
              <FootprintStage status={footprintStatus} signals={signals} plan={plan} />
              <MarketStage
                status={marketStatus}
                audience={audience}
                competitors={competitors}
                competitorsWorking={competitorsWorking}
                elapsed={marketElapsed}
              />
            </>
          ) : null}

          {step === 2 ? (
            <PlanStage
              status={planStatus}
              elapsed={planElapsed}
              plan={plan}
              notes={planNotes}
              error={planError}
              channel={effectiveChannel}
              topicIndex={topicIndex}
              onTopicIndexChange={(i) => {
                setTopicIndex(i);
                setTopic(plan?.contentTypes[i]?.topic ?? "");
              }}
              topic={topic}
              onTopicChange={setTopic}
              goal={goal}
              onGoalChange={setGoal}
              onReplan={() => kit && runPlan(kit, signals, goal, audience)}
              onWrite={writePost}
              writing={generating}
              onRetry={() => kit && runPlan(kit, signals, goal, audience)}
              pickedChannels={pickedChannels}
              onToggleChannel={(name) =>
                setPickedChannels((prev) =>
                  prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                )
              }
              pickedFormats={pickedFormats}
              onToggleFormat={(name) =>
                setPickedFormats((prev) =>
                  prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                )
              }
              onRebuild={runRebuild}
              rebuilding={rebuilding}
              dirty={selectionDirty}
            />
          ) : null}

          {step === 3 ? (
            <PostStage
              status={postStatus}
              brief={brief}
              content={content}
              onContentChange={setContent}
              publish={publish}
              onPublish={sendPost}
              publishing={publishing}
              published={published}
              error={renderError}
            />
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col">
          <Canvas
            mode={canvasMode}
            url={capture?.url ?? url}
            screenshot={capture?.screenshot ?? null}
            imgUrl={imgUrl}
            rendering={rendering}
            renderError={renderError}
            template={template}
            onTemplate={setTemplate}
          />
        </div>
      </main>

      {/* ---------------- footer: back, where you are, forward ---------------- */}
      <footer className="shrink-0 border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-6 py-3">
          <button
            onClick={() => goto(step - 1)}
            disabled={step === 0}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-30"
          >
            Back
          </button>

          <p className="min-w-0 truncate text-sm text-zinc-500">
            {phase === "failed"
              ? "Couldn't read that site."
              : !ready[step] && step === furthest
                ? `Working on ${STEPS[step].toLowerCase()}…`
                : step < 3 && !ready[step + 1]
                  ? `${STEPS[step + 1]} is still being written`
                  : ""}
          </p>

          {primary ? (
            <button
              onClick={primary.onClick}
              disabled={primary.disabled}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {primary.label}
            </button>
          ) : (
            <span className="w-16" />
          )}
        </div>
      </footer>
    </div>
  );
}
