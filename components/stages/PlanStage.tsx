"use client";

import { useState } from "react";
import type { MarketingPlan } from "@/types";
import { Stage, Skeleton, Working, type StageStatus } from "./Stage";

const MOVE_LABEL: Record<string, string> = {
  "start-here": "Start here",
  next: "Next",
  later: "Later",
  skip: "Skip",
};

/**
 * Decision first, rationale folded. The user answers two questions here -
 * which channel, which post - and presses one button. Everything that
 * justifies the answer lives under "Why this plan".
 */
export function PlanStage({
  status,
  elapsed,
  plan,
  notes,
  error,
  channel,
  topicIndex,
  onTopicIndexChange,
  topic,
  onTopicChange,
  goal,
  onGoalChange,
  onReplan,
  onWrite,
  writing,
  onRetry,
  pickedChannels,
  onToggleChannel,
  pickedFormats,
  onToggleFormat,
  onRebuild,
  rebuilding,
  dirty,
  replanning,
}: {
  status: StageStatus;
  elapsed: number;
  plan: MarketingPlan | null;
  notes: string[];
  error: string | null;
  channel: string;
  topicIndex: number;
  onTopicIndexChange: (i: number) => void;
  topic: string;
  onTopicChange: (v: string) => void;
  goal: string;
  onGoalChange: (v: string) => void;
  onReplan: () => void;
  onWrite: () => void;
  writing: boolean;
  onRetry: () => void;
  pickedChannels: string[];
  onToggleChannel: (name: string) => void;
  pickedFormats: string[];
  onToggleFormat: (name: string) => void;
  onRebuild: () => void;
  rebuilding: boolean;
  /** The selection no longer matches the plan on screen. */
  dirty: boolean;
  /** A redo is in flight. The old plan stays on screen underneath it. */
  replanning: boolean;
}) {
  const [why, setWhy] = useState(false);
  const [changing, setChanging] = useState(false);

  // Ordered by the plan, filtered to what the founder actually ticked.
  const selectedChannels = plan?.channels.filter((c) => pickedChannels.includes(c.name)) ?? [];

  const meta =
    status === "working"
      ? `${elapsed.toFixed(0)}s`
      : plan
        ? (
          <button onClick={() => setChanging((v) => !v)} className="underline-offset-2 hover:underline">
            Change the plan
          </button>
        )
        : undefined;

  return (
    <Stage title="Plan" status={status} meta={meta} emphasis={status === "done"}>
      {status === "pending" ? (
        <p className="text-sm">Where to post first, how often, and the first three posts to write.</p>
      ) : null}

      {status === "working" ? (
        <div className="flex flex-col gap-3">
          <Working>{elapsed < 35 ? "Writing the plan" : "Still writing, this one is thorough"}</Working>
          <Skeleton className="h-4 w-3/4" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <p className="text-xs text-ink-mute">About a minute. The brand and footprint above are already final.</p>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="text-sm">
          <p className="text-danger-fg">{error}</p>
          <button onClick={onRetry} className="mt-2 font-medium text-danger-fg underline">
            Try again
          </button>
        </div>
      ) : null}

      {status === "done" && plan ? (
        <div className={`flex flex-col gap-4 ${replanning ? "opacity-60" : ""}`}>
          {notes.length ? (
            <p className="rounded-lg bg-warn px-3 py-2 text-xs text-warn-fg ring-1 ring-inset ring-warn-line">
              {notes.join("; ")}
            </p>
          ) : null}

          {/*
            The plan proposed this, but the founder knows their buyer better
            than we do. Everything here is a checkbox: uncheck a channel we
            recommended, check one we skipped, and the plan gets rewritten for
            what they actually chose.
          */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-mute">
              Where you&apos;ll post
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {plan.channels.map((c) => {
                const on = pickedChannels.includes(c.name);
                // "later" and "skip" are different advice and used to read the same.
                const aside = c.move === "skip" ? "we'd skip" : c.move === "later" ? "later" : null;
                return (
                  <li key={c.name}>
                    <button
                      onClick={() => onToggleChannel(c.name)}
                      aria-pressed={on}
                      title={c.rationale}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        on
                          ? "border-ink bg-invert text-invert-fg"
                          : "border-line text-ink-soft hover:border-line-strong"
                      }`}
                    >
                      {c.name}
                      {aside ? (
                        <span className={on ? "text-invert-fg/70" : "text-ink-mute"}> · {aside}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {selectedChannels.length ? (
              <p className="mt-2 text-sm text-ink-soft">
                {selectedChannels[0].name} first, {selectedChannels[0].cadence.toLowerCase()}
                {selectedChannels.length > 1 ? ` · then ${selectedChannels.slice(1).map((c) => c.name).join(", ")}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-warn-fg">Pick at least one channel.</p>
            )}
          </div>

          {/* ---- the post decision ---- */}
          <h3 className="-mb-1 text-xs font-medium uppercase tracking-wider text-ink-mute">
            What you&apos;ll make
          </h3>
          <ul className="flex flex-col gap-2">
            {plan.contentTypes.map((ct, i) => {
              const selected = topicIndex === i;
              return (
                <li key={ct.name}>
                  <div
                    className={`rounded-lg border transition ${
                      selected ? "border-ink bg-raised" : "border-line hover:border-line-strong"
                    }`}
                  >
                    <button
                      onClick={() => onTopicIndexChange(i)}
                      aria-pressed={selected}
                      className="w-full px-3 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span
                          role="checkbox"
                          aria-checked={pickedFormats.includes(ct.name)}
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFormat(ct.name);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              onToggleFormat(ct.name);
                            }
                          }}
                          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${
                            pickedFormats.includes(ct.name)
                              ? "border-ink bg-invert text-invert-fg"
                              : "border-line-strong"
                          }`}
                        >
                          {pickedFormats.includes(ct.name) ? "✓" : ""}
                        </span>
                        {ct.name}
                      </span>
                      {selected ? null : (
                        <span className="mt-0.5 block text-sm text-ink-soft">{ct.topic}</span>
                      )}
                    </button>
                    {selected ? (
                      <div className="px-3 pb-3">
                        <textarea
                          value={topic}
                          onChange={(e) => onTopicChange(e.target.value)}
                          rows={2}
                          className="w-full resize-none rounded-md border border-line-strong bg-surface p-2 text-sm outline-none focus:border-ink"
                          aria-label="Post brief"
                        />
                        <p className="mt-1.5 text-xs text-ink-mute">{ct.why}</p>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {changing || replanning ? (
            <div className="flex flex-col gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onReplan();
                }}
                className="flex gap-2"
              >
                <input
                  value={goal}
                  onChange={(e) => onGoalChange(e.target.value)}
                  placeholder="Use Instagram instead. Or: we only have two hours a week"
                  disabled={replanning}
                  className="min-w-0 flex-1 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-raised"
                />
                <button
                  type="submit"
                  disabled={replanning}
                  className="shrink-0 rounded-lg border border-line-strong px-3 py-2 text-sm font-medium disabled:opacity-40"
                >
                  {replanning ? "Redoing…" : "Redo the plan"}
                </button>
              </form>
              {/*
                The old plan stays on screen underneath while this runs, so
                without a line here the click looks like it did nothing for the
                sixty seconds the rewrite takes.
              */}
              {replanning ? (
                <p className="text-sm text-ink-soft">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ink-mute align-middle" aria-hidden />
                  Rewriting the whole plan around that. About a minute — the plan below is the old one.
                </p>
              ) : null}
            </div>
          ) : null}

          {dirty ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-invert px-3 py-2.5 text-sm text-invert-fg">
              <span>
                {pickedChannels.length || 0} channel{pickedChannels.length === 1 ? "" : "s"},{" "}
                {pickedFormats.length} format{pickedFormats.length === 1 ? "" : "s"} — the plan below is still the old one
              </span>
              <button
                onClick={onRebuild}
                disabled={rebuilding || !pickedChannels.length || !pickedFormats.length}
                className="rounded-lg bg-surface px-3 py-1.5 font-medium text-ink disabled:opacity-40"
              >
                {rebuilding ? "Rewriting…" : "Rebuild the plan"}
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setWhy((v) => !v)} className="text-sm text-ink-soft hover:text-ink">
              <span aria-hidden className="mr-1 inline-block transition-transform" style={{ transform: why ? "rotate(90deg)" : "none" }}>
                ›
              </span>
              Why this plan
            </button>
            <button
              onClick={onWrite}
              disabled={writing || !topic.trim()}
              className="rounded-lg bg-invert px-4 py-2 text-sm font-medium text-invert-fg disabled:opacity-40"
            >
              {writing ? "Writing…" : `Write this post for ${channel || "them"}`}
            </button>
          </div>

          {why ? <Why plan={plan} /> : null}
        </div>
      ) : null}
    </Stage>
  );
}

function Why({ plan }: { plan: MarketingPlan }) {
  return (
    <div className="flex flex-col gap-5 border-t border-line-soft pt-4 text-sm">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-mute">Channels, in order</h3>
        <ul className="space-y-2">
          {plan.channels.map((c) => (
            <li key={c.name} className="text-ink-soft">
              <span className="font-medium text-ink">{c.name}</span>
              <span className="text-ink-mute"> · {MOVE_LABEL[c.move] ?? c.move} · {c.cadence}</span>
              <p className="mt-0.5">{c.rationale}</p>
            </li>
          ))}
        </ul>
      </div>

      {plan.experiments.length ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-mute">Experiments</h3>
          <ul className="space-y-3">
            {plan.experiments.map((e) => (
              <li key={e.name} className="rounded-lg bg-raised p-3">
                <p className="font-medium">{e.name}</p>
                <p className="mt-1 text-ink-soft">{e.hypothesis}</p>
                <p className="mt-1.5 text-xs text-ink-soft">{e.method}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  <span className="font-medium text-ink-soft">Read out: </span>{e.readout}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.timeline.length ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-mute">First quarter</h3>
          <ol className="space-y-3">
            {plan.timeline.map((t) => (
              <li key={t.window} className="border-l-2 border-line pl-3">
                <p className="font-medium">
                  {t.window} <span className="font-normal text-ink-soft">— {t.focus}</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-ink-soft">
                  {t.deliverables.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
