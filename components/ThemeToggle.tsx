"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";
const COOKIE = "footprint-theme";
const NEXT: Record<Choice, Choice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Choice, string> = { system: "Auto", light: "Light", dark: "Dark" };

/**
 * The server decides the initial theme from the cookie and renders it onto
 * <html> (see layout.tsx). This button only has to record a new choice and
 * flip the class immediately so the change is felt before the next request.
 * "system" clears the class and lets the stylesheet follow the OS.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // "Auto" until mounted so the server and first client render agree; the
  // real choice is on <html> already and is read right after.
  const [choice, setChoice] = useState<Choice>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setChoice(current === "light" || current === "dark" ? current : "system");
    setMounted(true);
  }, []);

  const cycle = () => {
    const next = NEXT[choice];
    setChoice(next);
    const root = document.documentElement;
    root.dataset.theme = next;
    root.classList.remove("light", "dark");
    if (next !== "system") root.classList.add(next);
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABEL[choice]}. Click to switch.`}
      aria-label={`Theme: ${LABEL[choice]}. Click to switch.`}
      className={`label shrink-0 rounded border border-line px-2.5 py-1 text-ink-soft transition hover:border-ink hover:text-ink ${className}`}
    >
      {mounted ? LABEL[choice] : "Auto"}
    </button>
  );
}
