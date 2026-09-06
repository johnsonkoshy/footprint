"use client";

import type { BrandKit } from "@/types";

const SWATCHES = [
  { key: "primary", label: "Primary" },
  { key: "ink", label: "Ink" },
  { key: "surface", label: "Surface" },
  { key: "accent", label: "Accent" },
] as const;

export function KitPanel({
  kit,
  fonts,
  onChange,
  compact = false,
}: {
  kit: BrandKit;
  fonts?: { display: { requested: string; google: string }; body: { requested: string; google: string } };
  onChange?: (kit: BrandKit) => void;
  compact?: boolean;
}) {
  const setColor = (key: (typeof SWATCHES)[number]["key"], value: string) =>
    onChange?.({ ...kit, palette: { ...kit.palette, [key]: value.toUpperCase() } });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold tracking-tight">{kit.name}</span>
        <span className="truncate text-sm text-ink-soft">{kit.tagline}</span>
      </div>

      {kit.logo ? (
        <div className="flex items-center gap-3">
          {/* On its captured background, so a white wordmark is still visible here. */}
          <span
            className="flex h-14 min-w-0 flex-1 items-center justify-center rounded-lg px-3 ring-1 ring-inset ring-line/10"
            style={{ backgroundColor: kit.logo.background }}
          >
            {/* A data URI we captured ourselves; next/image has nothing to optimise. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={kit.logo.dataUri}
              alt={`${kit.name} logo`}
              className="max-h-9 w-auto max-w-full object-contain"
            />
          </span>
          {onChange ? (
            <button
              onClick={() => onChange({ ...kit, logo: null })}
              className="shrink-0 text-xs text-ink-mute underline hover:text-ink"
              title="Fall back to setting the name as a wordmark"
            >
              Use wordmark
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-2">
        {SWATCHES.map(({ key, label }) => (
          <label key={key} className="group flex cursor-pointer flex-col gap-1.5">
            <span className="relative block">
              <span
                className="block h-12 w-full rounded ring-1 ring-inset ring-line transition group-hover:ring-ink"
                style={{ backgroundColor: kit.palette[key] }}
              />
              {onChange ? (
                <input
                  type="color"
                  value={kit.palette[key]}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`${label} colour`}
                />
              ) : null}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="label">{label}</span>
              <span className="readout text-ink">{kit.palette[key]}</span>
            </span>
          </label>
        ))}
      </div>

      {!compact ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="label self-center">Display</dt>
            <dd className="truncate">
              {kit.typography.display}
              {fonts ? <span className="text-ink-mute"> → {fonts.display.google}</span> : null}
            </dd>
            <dt className="label self-center">Body</dt>
            <dd className="truncate">
              {kit.typography.body}
              {fonts ? <span className="text-ink-mute"> → {fonts.body.google}</span> : null}
            </dd>
            <dt className="label self-center">Radius</dt>
            <dd>{kit.geometry.radius}px</dd>
            <dt className="label self-center">Imagery</dt>
            <dd className="text-ink">{kit.imagery.style}</dd>
          </dl>

          <div className="rounded-lg bg-raised p-4 text-sm ring-1 ring-inset ring-line/70">
            <div className="label mb-1.5">
              Voice · {kit.voice.tone}
            </div>
            <p className="italic text-ink">&ldquo;{kit.voice.sample}&rdquo;</p>
            {kit.voice.avoid.length ? (
              <p className="mt-2.5 text-xs text-ink-soft">
                <span className="font-medium">Never:</span> {kit.voice.avoid.join(" · ")}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
