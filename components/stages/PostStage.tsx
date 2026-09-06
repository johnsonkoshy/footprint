"use client";

import type { ContentSet } from "@/types";
import type { Fidelity, WeekPost } from "@/lib/client";
import { Stage, Skeleton, Working, type StageStatus } from "./Stage";

/**
 * Ship: week one. One post per format the founder chose, each with a control -
 * the same topic written blind, without the voice guide - and a readout of
 * which voice rules the on-brand post actually held. The market's recurring
 * complaint is output you could put any logo on; this is where we show,
 * rather than claim, that these are not that.
 */
function FidelityReadout({ f, generic = false }: { f: Fidelity | null; generic?: boolean }) {
  if (!f) return null;
  if (!f.checked) {
    return <span className="readout text-ink-mute">no testable voice rules</span>;
  }
  const clean = f.held === f.checked;
  return (
    <span className={`readout ${generic ? "text-ink-mute" : clean ? "text-ok-fg" : "text-warn-fg"}`}>
      {generic
        ? `generic draft · holds ${f.held}/${f.checked}`
        : `${f.held}/${f.checked} voice rules held${f.hookFits ? "" : " · hook over 60"}`}
      {f.violations.length && !generic ? ` · broke: ${f.violations.join("; ")}` : ""}
    </span>
  );
}

export function PostStage({
  status,
  week,
  selected,
  onSelect,
  content,
  onContentChange,
  showControl,
  onToggleControl,
  channel,
  cadence,
  brandName,
  publish,
  onPublish,
  publishing,
  published,
  error,
}: {
  status: StageStatus;
  week: WeekPost[];
  selected: number;
  onSelect: (i: number) => void;
  content: ContentSet | null;
  onContentChange: (c: ContentSet) => void;
  showControl: boolean;
  onToggleControl: () => void;
  channel: string;
  cadence: string;
  brandName: string;
  publish: { configured: boolean; name: string } | null;
  onPublish: () => void;
  publishing: boolean;
  published: string | null;
  error: string | null;
}) {
  const cur = week[selected] ?? null;
  const ready = week.filter((w) => w.content).length;

  const copyCaption = () => {
    if (!content) return;
    const text = `${content.caption}\n\n${content.hashtags.map((h) => `#${h}`).join(" ")}`.trim();
    void navigator.clipboard?.writeText(text);
  };

  /** The whole week as a handoff a founder can paste into notes or a scheduler. */
  const exportWeek = () => {
    const lines: string[] = [
      `# ${brandName} · week one${channel ? ` · ${channel}` : ""}`,
      cadence ? `_${cadence}_` : "",
      "",
    ];
    week.forEach((w, i) => {
      if (!w.content) return;
      lines.push(`## Post ${i + 1} · ${w.format}`);
      lines.push(`**${w.content.hook}**`, "", w.content.caption, "");
      w.content.slides.filter(Boolean).forEach((sl) => lines.push(`- ${sl}`));
      lines.push("", w.content.hashtags.map((h) => `#${h}`).join(" "), "");
      if (w.fidelity) lines.push(`_${w.fidelity.held}/${w.fidelity.checked} voice rules held_`, "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${brandName.toLowerCase().replace(/\s+/g, "-") || "footprint"}-week-one.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const meta =
    status === "done" && week.length
      ? `${ready}/${week.length} written${channel ? ` · ${channel}` : ""}`
      : status === "done"
        ? "Edit the words, the image redraws"
        : undefined;

  return (
    <Stage title="Ship" status={status} meta={meta}>
      {status === "pending" ? (
        <p className="text-sm">Week one: a post for every format you chose, in their voice, on their colour.</p>
      ) : null}

      {status === "working" && !week.length ? (
        <div className="flex flex-col gap-3">
          <Working>Writing as them</Working>
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : null}

      {week.length ? (
        <div className="flex flex-col gap-5">
          {cadence ? <p className="readout text-ink-mute">{cadence.toLowerCase()}</p> : null}

          {/* ---- the strip ---- */}
          <ol className="flex flex-col gap-2">
            {week.map((w, i) => {
              const on = i === selected;
              return (
                <li key={w.id}>
                  <button
                    onClick={() => onSelect(i)}
                    disabled={!w.content}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 border-l-2 py-1.5 pl-3 text-left transition ${
                      on ? "border-ink" : "border-line hover:border-line-strong"
                    } disabled:cursor-default`}
                  >
                    <span className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-sunken ring-1 ring-inset ring-line">
                      {w.imgUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={w.imgUrl} alt="" className="h-full w-full object-cover" />
                      ) : w.content ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-active" aria-hidden />
                      ) : w.error ? (
                        <span className="readout text-danger-fg">×</span>
                      ) : (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-faint" aria-hidden />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="label">
                        post {i + 1} · {w.format}
                      </span>
                      <span className={`truncate text-sm ${w.content ? "text-ink" : "text-ink-mute"}`}>
                        {w.content ? w.content.hook : w.error ? w.error : "writing…"}
                      </span>
                      <FidelityReadout f={w.fidelity} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* ---- the selected post ---- */}
          {content && cur ? (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <input
                value={content.hook}
                onChange={(e) => onContentChange({ ...content, hook: e.target.value })}
                className="w-full border-b border-line bg-transparent py-1 text-base font-medium text-ink focus:border-ink focus:outline-none"
                aria-label="Headline"
              />
              <textarea
                value={content.caption}
                onChange={(e) => onContentChange({ ...content, caption: e.target.value })}
                rows={3}
                className="w-full resize-none border-b border-line bg-transparent py-1 text-sm text-ink focus:border-ink focus:outline-none"
                aria-label="Caption"
              />
              {content.hashtags.length ? (
                <p className="readout text-ink-mute">{content.hashtags.map((h) => `#${h}`).join(" ")}</p>
              ) : null}

              {/* ---- the control: what a voice-blind tool would have written ---- */}
              {cur.control ? (
                <div className="flex flex-col gap-2 border-l-2 border-line pl-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="label">Without the voice guide</span>
                    <button
                      onClick={onToggleControl}
                      aria-pressed={showControl}
                      className={`label border-b pb-0.5 transition ${
                        showControl ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"
                      }`}
                    >
                      {showControl ? "Showing generic on the stage" : "Put generic on the stage"}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-ink-soft">{cur.control.hook}</p>
                  <p className="text-sm text-ink-mute">{cur.control.caption}</p>
                  <FidelityReadout f={cur.controlFidelity} generic />
                </div>
              ) : (
                <p className="readout text-ink-faint">drafting the generic version for comparison…</p>
              )}

              {error ? <p className="text-sm text-danger-fg">{error}</p> : null}

              <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-3">
                <button onClick={copyCaption} className="label text-ink-soft hover:text-ink">
                  Copy caption
                </button>
                <button onClick={exportWeek} className="label text-ink-soft hover:text-ink">
                  Export week ↓
                </button>
                {publish?.configured ? (
                  <button
                    onClick={onPublish}
                    disabled={publishing}
                    className="label text-ink-soft hover:text-ink disabled:opacity-40"
                  >
                    {publishing ? "Posting" : `Post to ${publish.name}`}
                  </button>
                ) : null}
                {published ? (
                  <a href={published} target="_blank" rel="noreferrer" className="readout truncate text-ok-fg underline">
                    {published}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Stage>
  );
}
