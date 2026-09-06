"use client";

import type { BrandKit } from "@/types";
import { KitPanel } from "@/components/KitPanel";
import { Stage, Skeleton, Working, type StageStatus } from "./Stage";

export function BrandStage({
  status,
  elapsed,
  screenshot,
  siteTitle,
  kit,
  fonts,
  notes,
  onChange,
}: {
  status: StageStatus;
  elapsed: number;
  screenshot: string | null;
  siteTitle: string | null;
  kit: BrandKit | null;
  fonts?: Parameters<typeof KitPanel>[0]["fonts"];
  notes: string[];
  onChange: (kit: BrandKit) => void;
}) {
  const meta =
    status === "working"
      ? `${elapsed.toFixed(0)}s`
      : status === "done"
        ? "Click anything to change it"
        : undefined;

  return (
    <Stage title="Brand" status={status} meta={meta}>
      {status === "pending" ? (
        <p className="text-sm">We read their colours, type, logo, and voice off the homepage.</p>
      ) : null}

      {status === "working" ? (
        <div className="flex flex-col gap-3">
          {screenshot ? (
            <Working>Auditing the brand</Working>
          ) : (
            <Working>Opening {siteTitle ?? "the homepage"}</Working>
          )}
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : null}

      {status === "done" && kit ? (
        <div className="flex flex-col gap-4">
          {notes.length ? (
            <p className="rounded-lg bg-warn px-3 py-2 text-xs text-warn-fg ring-1 ring-inset ring-warn-line">
              {notes.join(". ")}
            </p>
          ) : null}
          <KitPanel kit={kit} fonts={fonts} onChange={onChange} />
        </div>
      ) : null}

      {status === "error" ? (
        <p className="text-sm text-danger-fg">{notes.join(" ") || "Couldn't read that site."}</p>
      ) : null}
    </Stage>
  );
}
