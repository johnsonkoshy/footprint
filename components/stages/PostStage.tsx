"use client";

import type { ContentSet } from "@/types";
import type { Brief } from "@/lib/client";
import { Stage, Skeleton, Working, type StageStatus } from "./Stage";

export function PostStage({
  status,
  brief,
  content,
  onContentChange,
  publish,
  onPublish,
  publishing,
  published,
  error,
}: {
  status: StageStatus;
  brief?: Brief;
  content: ContentSet | null;
  onContentChange: (c: ContentSet) => void;
  publish: { configured: boolean; name: string } | null;
  onPublish: () => void;
  publishing: boolean;
  published: string | null;
  error: string | null;
}) {
  const meta =
    status === "done" && brief
      ? `${brief.format ?? "Post"}${brief.channel ? ` for ${brief.channel}` : ""}`
      : status === "done"
        ? "Edit the words, the image redraws"
        : undefined;

  return (
    <Stage title="Post" status={status} meta={meta}>
      {status === "pending" ? <p className="text-sm">Written in their voice, set in their type, on their colour.</p> : null}

      {status === "working" ? (
        <div className="flex flex-col gap-3">
          <Working>Writing as them</Working>
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : null}

      {status === "done" && content ? (
        <div className="flex flex-col gap-3">
          <input
            value={content.hook}
            onChange={(e) => onContentChange({ ...content, hook: e.target.value })}
            className="w-full rounded-lg border border-transparent bg-raised px-3 py-2 text-base font-medium hover:border-line-strong focus:border-ink focus:bg-surface focus:outline-none"
            aria-label="Headline"
          />
          <textarea
            value={content.caption}
            onChange={(e) => onContentChange({ ...content, caption: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-lg border border-transparent bg-raised px-3 py-2 text-sm text-ink hover:border-line-strong focus:border-ink focus:bg-surface focus:outline-none"
            aria-label="Caption"
          />
          {content.hashtags.length ? (
            <p className="readout text-ink-mute">{content.hashtags.map((h) => `#${h}`).join(" ")}</p>
          ) : null}

          {error ? <p className="text-sm text-danger-fg">{error}</p> : null}

          {publish?.configured ? (
            <div className="flex items-center gap-3 border-t border-line-soft pt-3">
              <button
                onClick={onPublish}
                disabled={publishing}
                className="rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              >
                {publishing ? "Posting…" : `Post to ${publish.name}`}
              </button>
              {published ? (
                <a href={published} target="_blank" rel="noreferrer" className="truncate text-sm text-ok-fg underline">
                  {published}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Stage>
  );
}
