"use client";

import type { BrandKit, TemplateId } from "@/types";

/**
 * The right-hand pane. It always shows the brand as it currently exists:
 * nothing yet -> what we make (fixture pair) -> their homepage -> their post.
 * One surface, evolving, so the eye never has to move to find the artifact.
 */
export function Canvas({
  mode,
  kit,
  url,
  screenshot,
  imgUrl,
  rendering,
  renderError,
  template,
  onTemplate,
}: {
  mode: "empty" | "brand" | "screenshot" | "post";
  kit: BrandKit | null;
  url: string;
  screenshot: string | null;
  imgUrl: string | null;
  rendering: boolean;
  renderError: string | null;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 p-5 ring-1 ring-inset ring-zinc-200/70">
        {mode === "empty" ? (
          <div className="flex max-h-full w-full flex-col items-center gap-4">
            <div className="grid w-full max-w-[420px] grid-cols-2 gap-3">
              {/* Fixture renders: no API calls, so this is instant and free. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/render?fixture=stripe&template=statement" alt="Example post in Stripe's brand" className="w-full rounded-md shadow-md ring-1 ring-black/5" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/render?fixture=notion&template=split" alt="Example post in Notion's brand" className="w-full rounded-md shadow-md ring-1 ring-black/5" />
            </div>
            <p className="max-w-xs text-center text-sm text-zinc-500">
              Same topic, two brands. This is what we make. Paste yours.
            </p>
          </div>
        ) : null}

        {/*
          A cache hit has no screenshot to show but does have a brand, and the
          "paste yours" pitch would be nonsense next to it. Show what we read.
        */}
        {mode === "brand" && kit ? (
          <figure className="flex max-h-full w-full max-w-[440px] flex-col items-center gap-4">
            <div
              className="flex w-full flex-col items-center justify-center gap-4 rounded-xl p-10 shadow-lg ring-1 ring-black/5"
              style={{ backgroundColor: kit.palette.surface }}
            >
              {kit.logo ? (
                <span
                  className="flex items-center justify-center rounded-lg px-5 py-3"
                  style={{ backgroundColor: kit.logo.background }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={kit.logo.dataUri} alt={`${kit.name} logo`} className="max-h-12 w-auto" />
                </span>
              ) : (
                <span className="text-3xl font-semibold tracking-tight" style={{ color: kit.palette.ink }}>
                  {kit.name}
                </span>
              )}
              <p className="text-center text-sm" style={{ color: kit.palette.ink }}>
                {kit.tagline}
              </p>
              <div className="flex gap-2">
                {[kit.palette.primary, kit.palette.ink, kit.palette.accent].map((c) => (
                  <span
                    key={c}
                    className="h-8 w-8 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <figcaption className="text-sm text-zinc-500">
              Read from {url}. Choose a post and this becomes the artwork.
            </figcaption>
          </figure>
        ) : null}

        {mode === "screenshot" && screenshot ? (
          <figure className="flex max-h-full w-full flex-col items-center gap-3">
            <div className="w-full max-w-[520px] overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/10">
              <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-zinc-300" />
                <span className="h-2 w-2 rounded-full bg-zinc-300" />
                <span className="h-2 w-2 rounded-full bg-zinc-300" />
                <span className="ml-2 truncate text-xs text-zinc-400">{url}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot} alt={`Homepage of ${url}`} className="block max-h-[52vh] w-full object-cover object-top" />
            </div>
            <figcaption className="text-sm text-zinc-500">Reading it now. The palette is pulled off this page.</figcaption>
          </figure>
        ) : null}

        {mode === "post" ? (
          renderError ? (
            <p className="max-w-md text-center text-sm text-red-700">{renderError}</p>
          ) : imgUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imgUrl}
              alt="Rendered post"
              className={`max-h-full w-auto rounded-lg object-contain shadow-xl ring-1 ring-black/5 transition-opacity ${rendering ? "opacity-70" : ""}`}
            />
          ) : (
            <p className="text-sm text-zinc-400">Rendering…</p>
          )
        ) : null}
      </div>

      {mode === "post" ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex rounded-lg bg-zinc-100 p-0.5">
            {(["statement", "split"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTemplate(t)}
                className={`rounded-[6px] px-3 py-1.5 text-sm capitalize transition ${
                  template === t ? "bg-white font-medium shadow-sm" : "text-zinc-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-sm">
            {rendering ? <span className="text-xs text-zinc-400">redrawing…</span> : null}
            {imgUrl ? (
              <a href={imgUrl} download="footprint-post.png" className="text-zinc-600 underline-offset-2 hover:underline">
                Download PNG
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
