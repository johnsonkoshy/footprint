"use client";

export type LogEntry = { t: number; text: string; live?: boolean };

/** mm:ss from seconds, padded, so the column lines up in mono. */
export function stamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * The process narrating itself. Every line is a real event with its real
 * elapsed time - nothing here is a placeholder or a guess, which is what makes
 * it read as a machine at work rather than a loading state. The last entry can
 * be "live": still happening, marked with the one non-grey in the chrome.
 */
export function RunLog({ entries, limit = 7 }: { entries: LogEntry[]; limit?: number }) {
  if (!entries.length) return null;
  const shown = entries.slice(-limit);
  return (
    <div className="flex flex-col gap-2">
      <div className="label">Log</div>
      <ol className="readout flex flex-col gap-1 leading-relaxed">
        {shown.map((e, i) => (
          <li key={`${e.t}-${e.text}`} className={`rise flex gap-3 ${e.live ? "text-ink" : "text-ink-soft"}`}>
            <span className="shrink-0 text-ink-mute">{stamp(e.t)}</span>
            <span className="min-w-0 truncate">
              {e.text}
              {e.live && i === shown.length - 1 ? (
                <span aria-hidden className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-active align-middle" />
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
