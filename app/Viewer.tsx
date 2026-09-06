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
import { STAGE_CENTS, useBrandCache, type CachedBrand } from "@/lib/cache";
import { EMPTY_SIGNALS } from "@/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RunLog, stamp, type LogEntry } from "@/components/RunLog";
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

/** Founder verbs, not tool nouns: what you do at each step, not what we emit. */
const STEPS = ["Read", "Know", "Decide", "Ship"] as const;

/** One definition of "we advise this", used to seed the picks and to test them. */
const isRecommended = (c: { move: string }) => c.move === "start-here" || c.move === "next";

export function Viewer() {
  const params = useSearchParams();
  const [url, setUrl] = useState(params.get("url") ?? "");
  /** null means "follow the work"; a number means the user chose this step. */
  const [pinnedStep, setPinnedStep] = useState<number | null>(null);
  const started = useRef(false);
  /** A sessionStorage restore happened; enough to skip paying for extraction. */
  const restored = useRef(false);
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

  /**
   * The process narrating itself. Every entry is a real event at its real
   * elapsed time. The run's start lives inside this state, not in a ref: the
   * elapsed time is computed in the updater, so no function that render can
   * reach ever reads a ref, and the compiler has nothing to object to.
   */
  const [log, setLog] = useState<{ startedAt: number; entries: LogEntry[] }>({ startedAt: 0, entries: [] });
  const mark = useCallback((text: string, live = false) => {
    setLog((prev) => ({
      startedAt: prev.startedAt,
      entries: [
        ...prev.entries.map((e) => ({ ...e, live: false })),
        { t: prev.startedAt ? (Date.now() - prev.startedAt) / 1000 : 0, text, live },
      ],
    }));
  }, []);
  /** Reset the clock and the log at the start of a run. */
  const beginRun = useCallback((first: string) => {
    setLog({ startedAt: Date.now(), entries: [{ t: 0, text: first, live: true }] });
  }, []);

  /** Non-null once this run was served from the cache, for the banner. */
  const [fromCache, setFromCache] = useState<CachedBrand | null>(null);
  const { cached, loading: cacheLoading, save, start, forget, savePost } = useBrandCache(
    params.get("url") ?? url,
  );

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
      // These three were missing, so a refresh restored the kit and the plan
      // but silently dropped the whole Market stage - and because the restore
      // claims the run below, the Convex hydration that would have supplied
      // them never got a chance either.
      setSiteText(s.siteText ?? "");
      setAudience(s.audience ?? null);
      setCompetitors(s.competitors ?? null);
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
      // Deliberately NOT claiming the run here. A session written by an older
      // build can be missing whole stages, and claiming it would lock in that
      // hole - Convex has the data but would never get asked. The effect below
      // prefers the cache and only skips extraction, which is the expensive
      // part, when a session already gave us a kit.
      restored.current = true;
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
      mark(g.trim() ? `rewriting the plan · "${g.trim().slice(0, 40)}"` : "writing the plan", true);
      try {
        const res = await strategize(k, url.trim(), s, g, a);
        const first = res.plan.channels.find((c) => c.move === "start-here")?.name.toLowerCase();
        mark(`plan written · ${res.plan.audit.maturity}${first ? ` · ${first} first` : ""}`);
        setPlan(res.plan);
        setSignals(res.signals);
        setPlanNotes(res.usedFallback ? res.notes : []);
        setChannel(res.plan.channels.find((c) => c.move === "start-here")?.name ?? "");
        setPickedChannels(res.plan.channels.filter(isRecommended).map((c) => c.name));
        setPickedFormats(res.plan.contentTypes.map((c) => c.name));
        setTopicIndex(0);
        setTopic(res.plan.contentTypes[0]?.topic ?? "");
        save({ url: url.trim(), plan: res.plan, status: "ready", stage: undefined, addCents: STAGE_CENTS.plan });
      } catch (err) {
        setPlanError(String(err instanceof Error ? err.message : err));
      } finally {
        setPlanning(false);
      }
    },
    [url, save, mark],
  );

  /** Everything a finished run produced, restored without a single API call. */
  const hydrateFrom = useCallback((row: CachedBrand) => {
    if (row.kit) setKit(row.kit);
    if (row.signals) setSignals(row.signals);
    if (row.text) setSiteText(row.text);
    if (row.audience) setAudience(row.audience);
    if (row.competitors) setCompetitors(row.competitors);
    if (row.plan) {
      setPlan(row.plan);
      setPickedChannels(row.plan.channels.filter(isRecommended).map((c) => c.name));
      setPickedFormats(row.plan.contentTypes.map((c) => c.name));
      setChannel(row.plan.channels.find((c) => c.move === "start-here")?.name ?? "");
      setTopic(row.plan.contentTypes[0]?.topic ?? "");
      setTopicIndex(0);
    }
    setFromCache(row);
    setPhase("ready");
    setLog({
      startedAt: Date.now(),
      entries: [{ t: 0, text: `restored from cache · ${Math.round(row.cents ?? 17)}¢ and two minutes not spent` }],
    });
  }, []);

  const runFresh = async () => {
    const target = url.trim();
    if (!target) return;
    await forget(target);
    setFromCache(null);
    sessionStorage.removeItem(STORE_KEY);
    runExtract(target);
  };

  const runExtract = async (raw?: string) => {
    const target = (raw ?? url).trim();
    if (!target) return;
    setUrl(target);
    setFromCache(null);
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
    beginRun(`opening ${target}`);
    try {
      start(target);
      const { kit: k, ...rest } = await extractStream(target, (c) => {
        setCapture(c);
        setSignals(c.signals);
        setPhase("auditing");
        const surfaces = c.signals.surfaces.filter((f) => f.linked || f.reachable).length;
        mark(
          `homepage captured · ${c.signals.socials.length} social · ${surfaces} surfaces · ${
            c.signals.martech.length ? c.signals.martech.map((m) => m.name.toLowerCase()).join(", ") : "no martech"
          }`,
        );
        mark("auditing the brand", true);
        save({ url: target, stage: "analyzing" });
      });
      setKit(k);
      setMeta(rest);
      setSiteText(rest.text);
      setPhase("ready");
      mark(`palette read · ${k.palette.primary} · ${k.typography.display.toLowerCase()}${k.logo ? " · logo captured" : ""}`);
      save({
        url: target,
        kit: k,
        signals: rest.signals,
        text: rest.text,
        stage: "researching",
        addCents: STAGE_CENTS.extract,
      });
      runMarket(k, rest.signals, rest.text);
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err);
      setError(message);
      setPhase("failed");
      mark(`could not read the site · ${message.slice(0, 60)}`);
      save({ url: target, status: "failed", error: message.slice(0, 500) });
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

      mark("reading who this is for", true);
      readAudience(k, s, text)
        .then((res) => {
          setAudience(res.audience);
          const places = res.audience.icp.reduce((n, p) => n + p.where.length, 0);
          mark(`buyer named · ${res.audience.icp.length} profiles · ${places} places · ${res.audience.stage}`);
          save({ url: url.trim(), audience: res.audience, addCents: STAGE_CENTS.audience });
          runPlan(k, s, "", res.audience);
        })
        .catch(() => runPlan(k, s, "", null))
        .finally(() => setAudienceWorking(false));

      findCompetitors(k, text)
        .then((res) => {
          setCompetitors(res.data);
          mark(
            res.data.competitors.length
              ? `field researched · ${res.data.competitors.map((c) => c.name.toLowerCase()).join(", ")}`
              : "field researched · no clear competitor found",
          );
          save({ url: url.trim(), competitors: res.data, addCents: STAGE_CENTS.competitors });
        })
        .catch((err) =>
          setCompetitors({ competitors: [], note: `Couldn't research the field. ${String(err instanceof Error ? err.message : err)}` }),
        )
        .finally(() => setCompetitorsWorking(false));
    },
    [runPlan, save, url, mark],
  );

  /**
   * A cached row can be genuinely incomplete. Competitor research takes up to a
   * minute, and the row is marked ready as soon as the plan lands, so closing
   * the tab in that window leaves a row that is "ready" but has never had
   * competitors looked up. Restoring it as-is showed "no competitors found",
   * which is a lie - we never looked. Fill whatever is missing instead.
   */
  const fillGaps = useCallback(
    (row: CachedBrand) => {
      const target = row.url;
      if (!row.kit) return;

      if (!row.competitors) {
        setCompetitorsWorking(true);
        findCompetitors(row.kit, row.text ?? "")
          .then((res) => {
            setCompetitors(res.data);
            save({ url: target, competitors: res.data, addCents: STAGE_CENTS.competitors });
          })
          .catch((err) =>
            setCompetitors({
              competitors: [],
              note: `Couldn't research the field. ${String(err instanceof Error ? err.message : err)}`,
            }),
          )
          .finally(() => setCompetitorsWorking(false));
      }

      if (!row.audience) {
        setAudienceWorking(true);
        setMarketElapsed(0);
        readAudience(row.kit, row.signals ?? EMPTY_SIGNALS, row.text ?? "")
          .then((res) => {
            setAudience(res.audience);
            save({ url: target, audience: res.audience, addCents: STAGE_CENTS.audience });
            if (!row.plan) runPlan(row.kit!, row.signals ?? null, "", res.audience);
          })
          .catch(() => {})
          .finally(() => setAudienceWorking(false));
      } else if (!row.plan) {
        runPlan(row.kit, row.signals ?? null, "", row.audience);
      }
    },
    [runPlan, save],
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
      save({ url: url.trim(), plan: next });
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

    // Convex has not answered yet. Starting now would extract over a warm
    // cache and pay for it, so wait for a hit or a confirmed miss.
    if (cacheLoading) return;

    started.current = true;


    // Starting the run - from cache or from scratch - is the whole job of this
    // effect, and both paths set state synchronously so the first frame paints
    // the right thing. The cascade the rule guards against is the point here.
    /* eslint-disable react-hooks/set-state-in-effect */

    // The cache wins over a restored session: it is at least as complete, and
    // fillGaps tops up anything it is missing.
    if (cached?.status === "ready" && cached.kit) {
      setUrl(incoming);
      hydrateFrom(cached);
      fillGaps(cached);
      return;
    }

    // No usable cache, but a session gave us a kit. Extraction is the expensive
    // step, so keep what we have rather than paying for it twice.
    if (restored.current) return;

    runExtract(incoming);
    /* eslint-enable react-hooks/set-state-in-effect */
    // runExtract is recreated every render; the ref guard above is what makes
    // this run once, so depending on it would defeat the guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, cacheLoading, cached, hydrateFrom, fillGaps]);

  const runGenerate = async (override?: { brief?: Brief }) => {
    const t = topic.trim();
    if (!kit || !t) return;
    setGenerating(true);
    setRenderError(null);
    const b0 = override?.brief ?? brief;
    mark(`writing as them${b0?.channel ? ` · for ${b0.channel.toLowerCase()}` : ""}`, true);
    try {
      const made = await generate(kit, t, override?.brief ?? brief);
      setContent(made);
      mark(`post written · "${made.hook.slice(0, 40)}"`);
      const b = override?.brief ?? brief;
      savePost({ url: url.trim(), topic: t, channel: b?.channel, format: b?.format, content: made, template });
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

  const canvasMode = imgUrl || content
    ? "post"
    : capture?.screenshot
      ? "screenshot"
      : kit
        ? "brand"
        : "empty";

  const furthest = content ? 3 : plan ? 2 : audience ? 1 : 0;
  const ready = [Boolean(kit), Boolean(audience), Boolean(plan), Boolean(content)];

  /**
   * The view follows the work forward on its own until the user navigates, and
   * then stays where they put it. Derived rather than synced in an effect, so
   * there is no second render and no moment where the two disagree.
   */
  const step = pinnedStep ?? furthest;

  const goto = (i: number) => setPinnedStep(Math.max(0, Math.min(STEPS.length - 1, i)));

  // Plain conditionals rather than an IIFE: a function executed during render
  // gets its reachable closures analysed as render-time, and one of them
  // reads a ref.
  let primary: { label: string; onClick: () => void; disabled: boolean } | null = null;
  if (step === 2 && plan) {
    primary = {
      label: generating ? "Writing" : `Write for ${effectiveChannel || "them"}`,
      onClick: writePost,
      disabled: generating || !topic.trim() || !pickedChannels.length,
    };
  } else if (step < 3 && ready[step + 1]) {
    primary = { label: `Next: ${STEPS[step + 1]}`, onClick: () => goto(step + 1), disabled: false };
  } else if (step === 3 && content) {
    primary = { label: "Write another", onClick: () => goto(2), disabled: false };
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* ---------------- header: the rail ---------------- */}
      <header className="shrink-0 border-b border-line">
        <div className="mx-auto flex w-full max-w-[1500px] items-center gap-6 px-6 py-2.5">
          <Link href="/" className="label shrink-0 text-ink">
            Footprint
          </Link>

          <ol className="flex min-w-0 flex-1 items-center gap-5">
            {STEPS.map((label, i) => {
              const done = ready[i];
              const now = i === furthest && !done;
              const reachable = done || i <= furthest;
              return (
                <li key={label} className="flex min-w-0 items-center">
                  <button
                    onClick={() => reachable && goto(i)}
                    disabled={!reachable}
                    aria-current={step === i ? "step" : undefined}
                    className={`label flex items-center gap-2 border-b pb-1 transition ${
                      step === i
                        ? "border-ink text-ink"
                        : reachable
                          ? "border-transparent text-ink-soft hover:text-ink"
                          : "border-transparent text-ink-faint"
                    }`}
                  >
                    <span className="readout text-[10px] text-ink-mute">0{i + 1}</span>
                    {label}
                    {now ? (
                      <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-active" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <span className="readout hidden min-w-0 shrink truncate text-ink-mute sm:block">
            {url}
            {log.entries.length ? ` · ${stamp(log.entries[log.entries.length - 1].t)}` : ""}
          </span>
          <ThemeToggle />
          <Link href="/" className="label shrink-0 text-ink-soft hover:text-ink">
            Start over
          </Link>
        </div>
      </header>

      {/* ---------------- body: one step, one canvas, no page scroll ---------------- */}
      <main className="mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 grid-cols-1 gap-8 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* min-h-0 is what lets this column scroll instead of stretching the page. */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          {fromCache ? (
            <div className="readout flex flex-wrap items-center justify-between gap-2 border-l-2 border-ok-fg pl-3 text-ok-fg">
              <span>from cache · no api calls · {Math.round(fromCache.cents ?? 17)}¢ and two minutes not spent</span>
              <button onClick={runFresh} className="label text-ok-fg underline underline-offset-2">
                Run it fresh
              </button>
            </div>
          ) : null}

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
              replanning={planning && Boolean(plan)}
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

          <div className="mt-auto border-t border-line pt-4">
            <RunLog entries={log.entries} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <Canvas
            mode={canvasMode}
            kit={kit}
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

      {/* ---------------- footer: back, state, the one action ---------------- */}
      <footer className="shrink-0 border-t border-line bg-page">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-6 py-2.5">
          <button
            onClick={() => goto(step - 1)}
            disabled={step === 0}
            className="label text-ink-soft hover:text-ink disabled:opacity-30"
          >
            ‹ Back
          </button>

          <p className="readout min-w-0 truncate text-ink-mute">
            {phase === "failed"
              ? "couldn't read that site"
              : !ready[step] && step === furthest
                ? `working on ${STEPS[step].toLowerCase()}`
                : step < 3 && !ready[step + 1]
                  ? `${STEPS[step + 1].toLowerCase()} is still being written`
                  : step === 2 && plan
                    ? `${pickedChannels.length} channel${pickedChannels.length === 1 ? "" : "s"} · ${pickedFormats.length} format${pickedFormats.length === 1 ? "" : "s"} · ${selectionDirty ? "plan needs a rebuild" : "plan is current"}`
                    : ""}
          </p>

          {primary ? (
            <button
              onClick={primary.onClick}
              disabled={primary.disabled}
              className="label rounded bg-invert px-4 py-2 text-invert-fg disabled:opacity-40"
            >
              {primary.label} →
            </button>
          ) : (
            <span className="w-16" />
          )}
        </div>
      </footer>
    </div>
  );
}
