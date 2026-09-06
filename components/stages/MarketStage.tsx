"use client";

import { useState } from "react";
import type { Audience, Competitors } from "@/types";
import { Stage, Skeleton, Working, Chip, type StageStatus } from "./Stage";

const STAGE_LABEL: Record<string, string> = {
  "pre-launch": "Pre-launch",
  "just-launched": "Just launched",
  "early-traction": "Early traction",
};

/**
 * The founder's three unknowns: who buys this, who else sells it, what number
 * proves it works. The two halves arrive at different times - the buyer is
 * read off their own copy in seconds, the field needs live web search - so
 * each renders the moment it lands rather than waiting for the other.
 */
export function MarketStage({
  status,
  audience,
  competitors,
  competitorsWorking,
  elapsed,
}: {
  status: StageStatus;
  audience: Audience | null;
  competitors: Competitors | null;
  competitorsWorking: boolean;
  elapsed: number;
}) {
  const [open, setOpen] = useState(false);

  const meta =
    status === "working"
      ? `${elapsed.toFixed(0)}s`
      : audience
        ? (
          <button onClick={() => setOpen((v) => !v)} className="underline-offset-2 hover:underline">
            {open ? "Less" : "Who they are, in full"}
          </button>
        )
        : undefined;

  return (
    <Stage title="Market" status={status} meta={meta}>
      {status === "pending" ? (
        <p className="text-sm">Who buys this, who else sells it, and the one number that says it&apos;s working.</p>
      ) : null}

      {status === "working" && !audience ? (
        <div className="flex flex-col gap-3">
          <Working>Reading who this is for</Working>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-14" />
        </div>
      ) : null}

      {audience ? (
        <div className="flex flex-col gap-4">
          <div>
            <span className="label">{STAGE_LABEL[audience.stage] ?? audience.stage}</span>
            <p className="mt-2 text-lg font-medium leading-snug tracking-tight text-ink">{audience.positioning}</p>
          </div>

          {/* ---- the number ---- */}
          <div className="border-l-2 border-ink pl-3">
            <p className="label">North star</p>
            <p className="mt-1 text-base font-medium leading-snug text-ink">{audience.kpis.northStar.metric}</p>
            <p className="readout mt-1 text-ink">{audience.kpis.northStar.target}</p>
            <p className="mt-1.5 text-sm text-ink-soft">{audience.kpis.northStar.why}</p>
          </div>
          {audience.kpis.supporting.length ? (
            <ul className="-mt-2 flex flex-col gap-1 text-sm">
              {audience.kpis.supporting.map((k) => (
                <li key={k.metric} className="flex flex-wrap items-baseline gap-x-2 text-ink-soft">
                  <span>{k.metric}</span>
                  <span className="readout text-ink">{k.target}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* ---- who ---- */}
          <ul className="flex flex-col gap-2">
            {audience.icp.map((p) => (
              <li key={p.name} className="border-t border-line-soft pt-3">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{p.pain}</p>
                {p.where.length ? (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {p.where.map((w) => (
                      <Chip key={w}>{w}</Chip>
                    ))}
                  </p>
                ) : null}
                {open && p.signals.length ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                    {p.signals.map((sig) => (
                      <li key={sig}>· {sig}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>

          {/* ---- the field ---- */}
          <div className="border-t border-line-soft pt-3">
            <h3 className="label mb-2">Who else sells to them</h3>
            {competitorsWorking ? (
              <div className="flex flex-col gap-2">
                <Working>Searching the web</Working>
                <Skeleton className="h-10" />
              </div>
            ) : competitors?.competitors.length ? (
              <ul className="flex flex-col gap-2">
                {competitors.competitors.map((c) => (
                  <li key={c.url} className="text-sm">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {c.name}
                    </a>
                    <p className="mt-0.5 text-ink-soft">{c.positioning}</p>
                    <p className="mt-1 text-ink">
                      <span className="text-ink-mute">Your opening: </span>
                      {c.yourOpening}
                    </p>
                    {open ? <p className="mt-0.5 text-xs text-ink-soft">They do better: {c.theirEdge}</p> : null}
                  </li>
                ))}
              </ul>
            ) : competitors ? (
              <p className="text-sm text-ink-soft">
                {competitors.note || "We searched and found no clear competitor for this."}
              </p>
            ) : (
              // Null is not an empty result - it means the search never ran.
              <p className="text-sm text-ink-mute">Not researched yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </Stage>
  );
}
