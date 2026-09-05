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
          <p className="text-xs text-zinc-400">About a minute. The brand and footprint above are already final.</p>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="text-sm">
          <p className="text-red-700">{error}</p>
          <button onClick={onRetry} className="mt-2 font-medium text-red-800 underline">
            Try again
          </button>
        </div>
      ) : null}

      {status === "done" && plan ? (
        <div className="flex flex-col gap-4">
          {notes.length ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
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
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Where you&apos;ll post
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {plan.channels.map((c) => {
                const on = pickedChannels.includes(c.name);
                const advised = c.move === "start-here" || c.move === "next";
                return (
                  <li key={c.name}>
                    <button
                      onClick={() => onToggleChannel(c.name)}
                      aria-pressed={on}
                      title={c.rationale}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        on
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 text-zinc-500 hover:border-zinc-400"
                      }`}
                    >
                      {c.name}
                      {advised ? null : <span className={on ? "text-zinc-400" : "text-zinc-300"}> ·  we&apos;d skip</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {selectedChannels.length ? (
              <p className="mt-2 text-sm text-zinc-500">
                {selectedChannels[0].name} first, {selectedChannels[0].cadence.toLowerCase()}
                {selectedChannels.length > 1 ? ` · then ${selectedChannels.slice(1).map((c) => c.name).join(", ")}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-700">Pick at least one channel.</p>
            )}
          </div>

          {/* ---- the post decision ---- */}
          <h3 className="-mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
            What you&apos;ll make
          </h3>
          <ul className="flex flex-col gap-2">
            {plan.contentTypes.map((ct, i) => {
              const selected = topicIndex === i;
              return (
                <li key={ct.name}>
                  <div
                    className={`rounded-lg border transition ${
                      selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
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
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300"
                          }`}
                        >
                          {pickedFormats.includes(ct.name) ? "✓" : ""}
                        </span>
                        {ct.name}
                      </span>
                      {selected ? null : (
                        <span className="mt-0.5 block text-sm text-zinc-500">{ct.topic}</span>
                      )}
                    </button>
                    {selected ? (
                      <div className="px-3 pb-3">
                        <textarea
                          value={topic}
                          onChange={(e) => onTopicChange(e.target.value)}
                          rows={2}
                          className="w-full resize-none rounded-md border border-zinc-300 bg-white p-2 text-sm outline-none focus:border-zinc-900"
                          aria-label="Post brief"
                        />
                        <p className="mt-1.5 text-xs text-zinc-400">{ct.why}</p>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {changing ? (
            <div className="flex gap-2">
              <input
                value={goal}
                onChange={(e) => onGoalChange(e.target.value)}
                placeholder="We only have two hours a week"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
              <button
                onClick={() => {
                  setChanging(false);
                  onReplan();
                }}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
              >
                Redo the plan
              </button>
            </div>
          ) : null}

          {dirty ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-white">
              <span>
                {pickedChannels.length || 0} channel{pickedChannels.length === 1 ? "" : "s"},{" "}
                {pickedFormats.length} format{pickedFormats.length === 1 ? "" : "s"} — the plan below is still the old one
              </span>
              <button
                onClick={onRebuild}
                disabled={rebuilding || !pickedChannels.length || !pickedFormats.length}
                className="rounded-lg bg-white px-3 py-1.5 font-medium text-zinc-900 disabled:opacity-40"
              >
                {rebuilding ? "Rewriting…" : "Rebuild the plan"}
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setWhy((v) => !v)} className="text-sm text-zinc-500 hover:text-zinc-900">
              <span aria-hidden className="mr-1 inline-block transition-transform" style={{ transform: why ? "rotate(90deg)" : "none" }}>
                ›
              </span>
              Why this plan
            </button>
            <button
              onClick={onWrite}
              disabled={writing || !topic.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
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
    <div className="flex flex-col gap-5 border-t border-zinc-100 pt-4 text-sm">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Channels, in order</h3>
        <ul className="space-y-2">
          {plan.channels.map((c) => (
            <li key={c.name} className="text-zinc-600">
              <span className="font-medium text-zinc-900">{c.name}</span>
              <span className="text-zinc-400"> · {MOVE_LABEL[c.move] ?? c.move} · {c.cadence}</span>
              <p className="mt-0.5">{c.rationale}</p>
            </li>
          ))}
        </ul>
      </div>

      {plan.experiments.length ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Experiments</h3>
          <ul className="space-y-3">
            {plan.experiments.map((e) => (
              <li key={e.name} className="rounded-lg bg-zinc-50 p-3">
                <p className="font-medium">{e.name}</p>
                <p className="mt-1 text-zinc-600">{e.hypothesis}</p>
                <p className="mt-1.5 text-xs text-zinc-500">{e.method}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-600">Read out: </span>{e.readout}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.timeline.length ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">First quarter</h3>
          <ol className="space-y-3">
            {plan.timeline.map((t) => (
              <li key={t.window} className="border-l-2 border-zinc-200 pl-3">
                <p className="font-medium">
                  {t.window} <span className="font-normal text-zinc-500">— {t.focus}</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-zinc-600">
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
