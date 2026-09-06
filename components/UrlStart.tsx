"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = ["stripe.com", "tartinebakery.com", "craigslist.org"];

/**
 * The landing page's only interactive element, and the app's front door. It
 * hands the URL to /build as a query param so the run starts on arrival -
 * pasting here and pressing go is one action, not a click through a marketing
 * page followed by typing the same thing again.
 */
export function UrlStart() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  const go = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/build?url=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(url);
        }}
        className="flex max-w-xl gap-2"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourcompany.com"
          aria-label="Your company URL"
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-line-strong px-4 py-3 text-base outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="shrink-0 rounded-lg bg-invert px-6 py-3 text-base font-medium text-invert-fg disabled:opacity-40"
        >
          Start
        </button>
      </form>
      <p className="text-sm text-ink-soft">
        Or try{" "}
        {EXAMPLES.map((u, i) => (
          <span key={u}>
            {i > 0 ? ", " : ""}
            <button onClick={() => go(u)} className="underline underline-offset-2 hover:text-ink">
              {u}
            </button>
          </span>
        ))}
        .
      </p>
    </div>
  );
}
