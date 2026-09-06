"use client";

import type { ReactNode } from "react";

/**
 * One chapter of the story, without the box. Cards read as "form"; the
 * instrument sits content on the page under a hairline and a mono label.
 * Status is carried by the label: a pending chapter is muted, a working one
 * has the live dot, an error one goes to the danger colour. The chapter that
 * is asking for a decision gets a left rule instead of a heavier border.
 */
export type StageStatus = "pending" | "working" | "done" | "error";

export function Stage({
  title,
  status,
  meta,
  emphasis = false,
  children,
}: {
  title: string;
  status: StageStatus;
  /** Right-aligned readout: elapsed time, a hint, an affordance. */
  meta?: ReactNode;
  /** The stage that is asking the user for a decision. */
  emphasis?: boolean;
  children?: ReactNode;
}) {
  const labelTone =
    status === "error" ? "text-danger-fg" : status === "pending" ? "text-ink-faint" : "text-ink-mute";

  return (
    <section
      className={`border-t border-line pt-4 ${emphasis ? "border-l-2 border-l-ink pl-4" : ""} ${
        status === "pending" ? "text-ink-mute" : ""
      }`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className={`label flex items-center gap-2 ${labelTone}`}>
          {title}
          {status === "working" ? (
            <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-active" />
          ) : null}
        </h2>
        {meta ? <span className="readout shrink-0 text-ink-mute">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

/** A grey bar standing in for text that is on its way. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-sunken ${className}`} aria-hidden />;
}

/** Working-state copy: an ellipsis means "in progress", nothing else. */
export function Working({ children }: { children: ReactNode }) {
  return (
    <p className="readout text-ink-soft">
      <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-active align-middle" aria-hidden />
      {children}…
    </p>
  );
}

/** A measured fact, set as a readout. `quiet` for "we looked and found none". */
export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "quiet" }) {
  return (
    <span className={`readout inline-flex items-center ${tone === "quiet" ? "text-ink-faint" : "text-ink"}`}>
      {children}
    </span>
  );
}
