"use client";

import Link from "next/link";
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

export function Viewer() {
  const [url, setUrl] = useState("");
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

  const planRef = useRef<HTMLDivElement>(null);
  const postRef = useRef<HTMLDivElement>(null);

  // ---------- persistence: a refresh must not cost a minute ----------
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (!s.kit) return;
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
      setPhase("ready");
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
          url, kit, meta, capture, signals, siteText, audience, competitors,
          plan, channel, goal, brief, topicIndex, topic, content, template,
        }),
      );
    } catch {
      /* quota or private mode - state just won't survive a refresh */
    }
  }, [url, kit, meta, capture, signals, siteText, audience, competitors, plan, channel, goal, brief, topicIndex, topic, content, template]);

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
        setPickedChannels(
          res.plan.channels.filter((c) => c.move === "start-here" || c.move === "next").map((c) => c.name),
        );
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

  const runExtract = async () => {
    if (!url.trim()) return;
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
    try {
      const { kit: k, ...rest } = await extractStream(url.trim(), (c) => {
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
    postRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  // Bring the decision into view when it lands; the user was reading above it.
  useEffect(() => {
    if (plan && !content) planRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [plan, content]);


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

  // The plan on screen was written for a different selection than the one ticked.
  const planChannels = plan?.channels.filter((c) => c.move !== "skip").map((c) => c.name) ?? [];
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

  const steps: { label: string; state: "done" | "now" | "todo" }[] = [
    { label: "Brand", state: kit ? "done" : extracting ? "now" : "todo" },
    { label: "Footprint", state: signals && audience ? "done" : signals ? "now" : "todo" },
    { label: "Market", state: audience ? "done" : audienceWorking ? "now" : "todo" },
    { label: "Plan", state: brief ? "done" : plan ? "now" : "todo" },
    { label: "Post", state: imgUrl ? "done" : generating ? "now" : "todo" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------------- top bar ---------------- */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-6 py-3">
          <span className="shrink-0 text-sm font-semibold tracking-tight">Footprint</span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runExtract();
            }}
            className="flex min-w-0 flex-1 gap-2"
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="stripe.com"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-900"
              aria-label="Company URL"
            />
            <button
              type="submit"
              disabled={extracting || !url.trim()}
              className="shrink-0 rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {extracting ? "Reading…" : "Read the brand"}
            </button>
          </form>
          <Link href="/compare" className="shrink-0 text-sm text-zinc-500 hover:text-zinc-900">
            Compare two brands
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------------- left: the story ---------------- */}
        <div className="flex flex-col gap-4">
          <ol className="flex items-center gap-2 text-xs">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                {i > 0 ? <span className="text-zinc-300">—</span> : null}
                <span
                  className={
                    s.state === "done"
                      ? "text-zinc-900"
                      : s.state === "now"
                        ? "font-medium text-zinc-900"
                        : "text-zinc-400"
                  }
                >
                  {s.state === "done" ? "✓ " : null}
                  {s.label}
                </span>
              </li>
            ))}
          </ol>

          {phase === "idle" && !kit ? (
            <p className="text-sm text-zinc-500">
              Try{" "}
              {["stripe.com", "tartinebakery.com", "craigslist.org"].map((u, i) => (
                <span key={u}>
                  {i > 0 ? ", " : ""}
                  <button onClick={() => setUrl(u)} className="underline underline-offset-2 hover:text-zinc-900">
                    {u}
                  </button>
                </span>
              ))}
              .
            </p>
          ) : null}

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

          <FootprintStage status={footprintStatus} signals={signals} plan={plan} />

          <MarketStage
            status={marketStatus}
            audience={audience}
            competitors={competitors}
            competitorsWorking={competitorsWorking}
            elapsed={marketElapsed}
          />

          <div ref={planRef}>
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
          </div>

          <div ref={postRef}>
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
          </div>
        </div>

        {/* ---------------- right: the artifact ---------------- */}
        <div className="lg:sticky lg:top-[60px] lg:self-start">
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
    </div>
  );
}
