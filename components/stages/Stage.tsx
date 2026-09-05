"use client";

import type { ReactNode } from "react";

/**
 * One chapter of the story. The left column is four of these, top to bottom,
 * and the visual state of each one tells you where the process is without a
 * spinner: pending chapters are dimmed and dashed, the working one carries a
 * live meta line, done ones are plain.
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
  /** Right-aligned small text: elapsed time, a hint, an affordance. */
  meta?: ReactNode;
  /** The stage that is asking the user for a decision. */
  emphasis?: boolean;
  children?: ReactNode;
}) {
  const shell =
    status === "pending"
      ? "border-dashed border-zinc-200 text-zinc-400"
      : status === "error"
        ? "border-red-200 bg-red-50/40"
        : emphasis
          ? "border-zinc-400"
          : "border-zinc-200";

  return (
    <section className={`rounded-xl border bg-white p-4 transition-colors ${shell}`}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className={`text-sm font-medium ${status === "pending" ? "text-zinc-400" : "text-zinc-900"}`}>
          {title}
        </h2>
        {meta ? <span className="shrink-0 text-xs text-zinc-400">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

/** A grey bar standing in for text that is on its way. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-zinc-100 ${className}`} aria-hidden />;
}

/** Working-state copy: an ellipsis means "in progress", nothing else. */
export function Working({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-zinc-500">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 align-middle" aria-hidden />
      {children}…
    </p>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "quiet" }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${
        tone === "quiet" ? "border-zinc-100 text-zinc-400" : "border-zinc-200 text-zinc-600"
      }`}
    >
      {children}
    </span>
  );
}
