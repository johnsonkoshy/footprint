"use client";

import type { TemplateId } from "@/types";

/**
 * The right-hand pane. It always shows the brand as it currently exists:
 * nothing yet -> what we make (fixture pair) -> their homepage -> their post.
 * One surface, evolving, so the eye never has to move to find the artifact.
 */
export function Canvas({
  mode,
  url,
  screenshot,
  imgUrl,
  rendering,
  renderError,
  template,
  onTemplate,
}: {
  mode: "empty" | "screenshot" | "post";
  url: string;
  screenshot: string | null;
  imgUrl: string | null;
  rendering: boolean;
  renderError: string | null;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-xl bg-zinc-100 p-5 ring-1 ring-inset ring-zinc-200/70">
        {mode === "empty" ? (
          <div className="flex w-full flex-col items-center gap-4">
            <div className="grid w-full max-w-[560px] grid-cols-2 gap-3">
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

        {mode === "screenshot" && screenshot ? (
          <figure className="flex w-full flex-col items-center gap-3">
            <div className="w-full max-w-[560px] overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/10">
              <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-zinc-300" />
                <span className="h-2 w-2 rounded-full bg-zinc-300" />
                <span className="h-2 w-2 rounded-full bg-zinc-300" />
                <span className="ml-2 truncate text-xs text-zinc-400">{url}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot} alt={`Homepage of ${url}`} className="block w-full" />
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
              className={`max-h-[78vh] w-auto rounded-lg shadow-xl ring-1 ring-black/5 transition-opacity ${rendering ? "opacity-70" : ""}`}
            />
          ) : (
            <p className="text-sm text-zinc-400">Rendering…</p>
          )
        ) : null}
      </div>

      {mode === "post" ? (
        <div className="flex items-center justify-between gap-3">
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
