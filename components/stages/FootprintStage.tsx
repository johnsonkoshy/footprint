"use client";

import { useState } from "react";
import type { MarketingPlan, SiteSignals } from "@/types";
import { Stage, Skeleton, Working, Chip, type StageStatus } from "./Stage";

const MATURITY: Record<string, { label: string; className: string }> = {
  invisible: { label: "Invisible", className: "bg-sunken text-ink-soft ring-line" },
  emerging: { label: "Emerging", className: "bg-warn text-warn-fg ring-warn-line" },
  active: { label: "Active", className: "bg-info text-info-fg ring-info-line" },
  advanced: { label: "Advanced", className: "bg-ok text-ok-fg ring-ok-line" },
};

/**
 * Two things arrive at two different times and both belong here. The evidence
 * comes free with the screenshot, so it lands at ~6s; the verdict is the
 * model's and lands a minute later. Showing the evidence first is the point -
 * it is what the verdict will be judged against.
 */
export function FootprintStage({
  status,
  signals,
  plan,
}: {
  status: StageStatus;
  signals: SiteSignals | null;
  plan: MarketingPlan | null;
}) {
  const [open, setOpen] = useState(false);
  const surfaces = signals?.surfaces.filter((f) => f.linked || f.reachable) ?? [];
  const maturity = plan ? (MATURITY[plan.audit.maturity] ?? MATURITY.emerging) : null;

  const meta = plan ? (
    <button onClick={() => setOpen((v) => !v)} className="underline-offset-2 hover:underline">
      {open ? "Less" : "Everything we found"}
    </button>
  ) : status === "working" ? (
    "Measured, not guessed"
  ) : undefined;

  return (
    <Stage title="Footprint" status={status} meta={meta}>
      {status === "pending" ? (
        <p className="text-sm">Which channels they&apos;ve claimed, what content exists, and what marketing tech is running.</p>
      ) : null}

      {signals ? (
        <div className="flex flex-col gap-3">
          {/* Verdict, or the space it will occupy. */}
          {plan && maturity ? (
            <div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${maturity.className}`}>
                {maturity.label}
              </span>
              <p className="mt-2 text-base font-medium leading-snug tracking-tight">{plan.audit.headline}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Working>Auditing what they already do</Working>
              <Skeleton className="h-5 w-4/5" />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <Chip tone={signals.socials.length ? "neutral" : "quiet"}>
              {signals.socials.length ? signals.socials.map((s) => s.platform).join(", ") : "No social accounts linked"}
            </Chip>
            <Chip tone={surfaces.length ? "neutral" : "quiet"}>
              {surfaces.length ? surfaces.map((f) => f.label).join(", ") : "No content surfaces"}
            </Chip>
            <Chip tone={signals.martech.length ? "neutral" : "quiet"}>
              {signals.martech.length ? signals.martech.map((m) => m.name).join(", ") : "No marketing tech detected"}
            </Chip>
            {signals.hasNewsletterCapture ? <Chip>Email capture</Chip> : null}
          </div>

          {open && plan ? (
            <div className="grid gap-4 border-t border-line-soft pt-3 text-sm sm:grid-cols-2">
              <ul className="space-y-1.5 text-ink-soft">
                {plan.audit.strengths.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span aria-hidden className="text-ok-fg">+</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <ul className="space-y-1.5 text-ink-soft">
                {plan.audit.gaps.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span aria-hidden className="text-warn-fg">–</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <p className="text-ink-soft sm:col-span-2">{plan.audit.summary}</p>
              <dl className="space-y-1 text-xs text-ink-soft sm:col-span-2">
                {signals.martech.length ? (
                  <div>
                    <dt className="inline font-medium text-ink">Marketing tech: </dt>
                    <dd className="inline">{signals.martech.map((m) => `${m.name} (${m.category})`).join(", ")}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="inline font-medium text-ink">Sharing and capture: </dt>
                  <dd className="inline">
                    {[
                      signals.hasOgImage ? "Open Graph image" : "no Open Graph image",
                      signals.hasTwitterCard ? "Twitter card" : "no Twitter card",
                      signals.hasRss ? "RSS" : "no RSS",
                    ].join(", ")}
                  </dd>
                </div>
                {signals.softNotFound ? (
                  <p className="text-warn-fg">This site answers 200 for any URL, so unlinked surfaces couldn&apos;t be probed.</p>
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>
      ) : status === "working" ? (
        <Working>Waiting for the page</Working>
      ) : null}
    </Stage>
  );
}
