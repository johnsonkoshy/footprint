"use client";

import { useState } from "react";
import type { MarketingPlan, SiteSignals } from "@/types";

/**
 * The plan is a proposal, not a result. Everything here exists so the user can
 * disagree with it before a single post gets written: swap the channel, rewrite
 * the brief, or send it back with a different goal.
 */

const MATURITY: Record<string, { label: string; className: string }> = {
  invisible: { label: "Invisible", className: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  emerging: { label: "Emerging", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  active: { label: "Active", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  advanced: { label: "Advanced", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
};

const MOVE: Record<string, { label: string; className: string }> = {
  "start-here": { label: "Start here", className: "bg-zinc-900 text-white" },
  next: { label: "Next", className: "bg-zinc-200 text-zinc-700" },
  later: { label: "Later", className: "bg-zinc-100 text-zinc-500" },
  skip: { label: "Skip", className: "bg-zinc-50 text-zinc-400 line-through decoration-zinc-300" },
};

const PRESENCE: Record<string, string> = {
  linked: "account found on their site",
  absent: "no account linked",
  unverifiable: "not visible from a homepage",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-100 pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Evidence({ signals }: { signals: SiteSignals }) {
  const [open, setOpen] = useState(false);
  const surfaces = signals.surfaces.filter((f) => f.linked || f.reachable);

  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-xs ring-1 ring-inset ring-zinc-200/70">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left font-medium text-zinc-600"
      >
        <span>
          What we actually found: {signals.socials.length} social{" "}
          {signals.socials.length === 1 ? "account" : "accounts"}, {surfaces.length} content{" "}
          {surfaces.length === 1 ? "surface" : "surfaces"}, {signals.martech.length} marketing tool
          {signals.martech.length === 1 ? "" : "s"}
        </span>
        <span className="ml-3 shrink-0 text-zinc-400">{open ? "hide" : "show"}</span>
      </button>

      {open ? (
        <dl className="mt-3 space-y-2 text-zinc-500">
          <div>
            <dt className="font-medium text-zinc-700">Social accounts linked</dt>
            <dd>
              {signals.socials.length
                ? signals.socials.map((s) => s.platform).join(", ")
                : "none found on the homepage"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700">Content surfaces</dt>
            <dd>
              {surfaces.length
                ? surfaces.map((f) => `${f.label}${f.linked ? "" : " (unlinked)"}`).join(", ")
                : "none found"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700">Marketing tech on the page</dt>
            <dd>
              {signals.martech.length
                ? signals.martech.map((m) => `${m.name} (${m.category})`).join(", ")
                : "nothing detected"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-700">Sharing and capture</dt>
            <dd>
              {[
                signals.hasNewsletterCapture ? "email capture" : "no email capture",
                signals.hasOgImage ? "Open Graph image" : "no Open Graph image",
                signals.hasTwitterCard ? "Twitter card" : "no Twitter card",
                signals.hasRss ? "RSS" : "no RSS",
              ].join(", ")}
            </dd>
          </div>
          {signals.softNotFound ? (
            <p className="text-amber-700">
              This site answers 200 for any URL, so unlinked surfaces could not be probed.
            </p>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

export function PlanPanel({
  plan,
  signals,
  goal,
  onGoalChange,
  onReplan,
  replanning,
  channel,
  onChannelChange,
  topicIndex,
  onTopicIndexChange,
  topic,
  onTopicChange,
  onConfirm,
}: {
  plan: MarketingPlan;
  signals: SiteSignals;
  goal: string;
  onGoalChange: (v: string) => void;
  onReplan: () => void;
  replanning: boolean;
  channel: string;
  onChannelChange: (v: string) => void;
  topicIndex: number;
  onTopicIndexChange: (i: number) => void;
  topic: string;
  onTopicChange: (v: string) => void;
  onConfirm: () => void;
}) {
  const maturity = MATURITY[plan.audit.maturity] ?? MATURITY.emerging;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 p-5">
      {/* -------- audit -------- */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${maturity.className}`}
          >
            {maturity.label}
          </span>
          <span className="text-xs text-zinc-400">current marketing footprint</span>
        </div>
        <p className="mt-2 text-lg font-medium leading-snug tracking-tight">{plan.audit.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{plan.audit.summary}</p>

        {plan.audit.strengths.length || plan.audit.gaps.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ul className="space-y-1.5 text-sm text-zinc-600">
              {plan.audit.strengths.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden className="text-emerald-600">
                    +
                  </span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-1.5 text-sm text-zinc-600">
              {plan.audit.gaps.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden className="text-amber-600">
                    –
                  </span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4">
          <Evidence signals={signals} />
        </div>
      </div>

      {/* -------- channels -------- */}
      <Section title="Where to post, in order">
        <ul className="space-y-2">
          {plan.channels.map((c) => {
            const move = MOVE[c.move] ?? MOVE.later;
            const selected = channel === c.name;
            return (
              <li key={c.name}>
                <button
                  onClick={() => onChannelChange(c.name)}
                  aria-pressed={selected}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {/* Spans, not p/div: a button may only contain phrasing content. */}
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${move.className}`}>
                      {move.label}
                    </span>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-zinc-400">{PRESENCE[c.presence] ?? c.presence}</span>
                  </span>
                  <span className="mt-1.5 block text-sm text-zinc-600">{c.rationale}</span>
                  <span className="mt-1 block text-xs text-zinc-500">Cadence: {c.cadence}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-zinc-400">Click a channel to write for it instead.</p>
      </Section>

      {/* -------- content types -------- */}
      <Section title="What to make first">
        <ul className="space-y-2">
          {plan.contentTypes.map((ct, i) => {
            const selected = topicIndex === i;
            return (
              <li key={ct.name}>
                {/*
                 * The card is a div, not a button. A textarea inside a button is
                 * invalid nesting, and it misbehaves: space and Enter typed in
                 * the brief would activate the button underneath it.
                 */}
                <div
                  className={`rounded-lg border transition ${
                    selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <button
                    onClick={() => onTopicIndexChange(i)}
                    aria-pressed={selected}
                    className="w-full p-3 text-left"
                  >
                    <span className="block font-medium">{ct.name}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{ct.why}</span>
                    {selected ? null : (
                      <span className="mt-2 block text-sm text-zinc-600">{ct.topic}</span>
                    )}
                  </button>

                  {selected ? (
                    <div className="px-3 pb-3">
                      <textarea
                        value={topic}
                        onChange={(e) => onTopicChange(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-md border border-zinc-300 bg-white p-2 text-sm outline-none focus:border-zinc-900"
                        aria-label="Post brief"
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* -------- experiments -------- */}
      {plan.experiments.length ? (
        <Section title="Experiments to run">
          <ul className="space-y-3">
            {plan.experiments.map((e) => (
              <li key={e.name} className="rounded-lg bg-zinc-50 p-3">
                <p className="text-sm font-medium">{e.name}</p>
                <p className="mt-1 text-sm text-zinc-600">{e.hypothesis}</p>
                <p className="mt-1.5 text-xs text-zinc-500">{e.method}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-600">Read out:</span> {e.readout}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* -------- timeline -------- */}
      {plan.timeline.length ? (
        <Section title="First quarter">
          <ol className="space-y-3">
            {plan.timeline.map((t) => (
              <li key={t.window} className="border-l-2 border-zinc-200 pl-3">
                <p className="text-sm font-medium">
                  {t.window} <span className="font-normal text-zinc-500">— {t.focus}</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-zinc-600">
                  {t.deliverables.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {/* -------- kpis -------- */}
      {plan.kpis.length ? (
        <Section title="What to measure">
          <ul className="space-y-2">
            {plan.kpis.map((k) => (
              <li key={k.metric} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{k.metric}</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{k.target}</span>
                <span className="w-full text-xs text-zinc-500">{k.why}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* -------- confirm -------- */}
      <Section title="Confirm">
        <div className="flex flex-col gap-3">
          <input
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="Anything the plan should account for? e.g. we're hiring, or we only have 2 hours a week"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onConfirm}
              disabled={!topic.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Approve plan and write for {channel || "this channel"}
            </button>
            <button
              onClick={onReplan}
              disabled={replanning}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              {replanning ? "Rethinking…" : "Redo the plan"}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
