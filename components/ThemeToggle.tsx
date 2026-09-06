"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";
const KEY = "footprint:theme";

/** Kept in sync with the inline script in layout.tsx, which runs before paint. */
function apply(choice: Choice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const NEXT: Record<Choice, Choice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Choice, string> = { system: "Auto", light: "Light", dark: "Dark" };

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Always "system" on the server and on the first client render, so the markup
  // matches; the real choice is read after mount. The inline script has already
  // painted the right colours, so there is nothing to see during the swap.
  const [choice, setChoice] = useState<Choice>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setChoice((localStorage.getItem(KEY) as Choice) ?? "system");
    setMounted(true);
  }, []);

  // Following the OS only means anything while the choice is "system".
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const cycle = () => {
    const next = NEXT[choice];
    setChoice(next);
    localStorage.setItem(KEY, next);
    apply(next);
  };

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABEL[choice]}. Click to switch.`}
      aria-label={`Theme: ${LABEL[choice]}. Click to switch.`}
      className={`shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-line-strong hover:text-ink ${className}`}
    >
      {mounted ? LABEL[choice] : "Auto"}
    </button>
  );
}
