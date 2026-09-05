"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Audience, BrandKit, Competitors, MarketingPlan, SiteSignals } from "@/types";

/**
 * The cache, from the browser's side.
 *
 * Extraction plus research costs roughly 17 cents and two minutes per company.
 * Pasting the same URL twice should cost neither, and during a demo it is the
 * difference between a two-minute wait and an instant result.
 *
 * Writes happen from the browser as each stage resolves rather than from the
 * API routes, for two reasons: there is no auth in this product so there are no
 * server credentials to thread through, and a run abandoned halfway still
 * leaves every stage it did finish in the cache.
 */

export const CONVEX_ENABLED = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

export type CachedBrand = {
  url: string;
  status: "working" | "ready" | "failed";
  kit?: BrandKit;
  signals?: SiteSignals;
  text?: string;
  audience?: Audience;
  competitors?: Competitors;
  plan?: MarketingPlan;
  cents?: number;
  updatedAt: number;
};

/** What each stage costs, measured. Used only to report what a hit saved. */
export const STAGE_CENTS = { extract: 5, audience: 3, competitors: 6, plan: 3 } as const;

export function useBrandCache(url: string) {
  const key = url.trim();
  // `undefined` means still loading; `null` means a confirmed miss. The caller
  // has to wait for the difference or it will extract over a warm cache.
  const cached = useQuery(
    api.brands.get,
    CONVEX_ENABLED && key ? { url: key } : "skip",
  ) as CachedBrand | null | undefined;

  const saveMutation = useMutation(api.brands.save);
  const startMutation = useMutation(api.brands.start);
  const forgetMutation = useMutation(api.brands.forget);
  const savePostMutation = useMutation(api.brands.savePost);

  // Wrapped rather than returned raw: these are dependencies of callbacks in
  // the viewer, and a fresh closure each render would defeat their memoisation.
  //
  // Every write is fire-and-forget - a cache failure must never break the run
  // that produced the data - but it is logged rather than swallowed. A silent
  // catch here once hid a document-too-large error behind a cache that simply
  // never hit.
  const save = useCallback(
    (args: Parameters<typeof saveMutation>[0]) => {
      if (!CONVEX_ENABLED) return;
      void saveMutation(args).catch((err) => console.warn("[footprint] cache write failed", err));
    },
    [saveMutation],
  );

  const start = useCallback(
    (u: string) => {
      if (!CONVEX_ENABLED) return;
      void startMutation({ url: u }).catch((err) => console.warn("[footprint] cache start failed", err));
    },
    [startMutation],
  );

  const forget = useCallback(
    (u: string) => {
      if (!CONVEX_ENABLED) return Promise.resolve();
      return forgetMutation({ url: u }).catch(() => {});
    },
    [forgetMutation],
  );

  const savePost = useCallback(
    (args: Parameters<typeof savePostMutation>[0]) => {
      if (!CONVEX_ENABLED) return;
      void savePostMutation(args).catch((err) => console.warn("[footprint] post save failed", err));
    },
    [savePostMutation],
  );

  return {
    cached,
    loading: CONVEX_ENABLED && Boolean(key) && cached === undefined,
    save,
    start,
    forget,
    savePost,
  };
}

export function useRecentBrands(limit = 8) {
  return useQuery(api.brands.listRecent, CONVEX_ENABLED ? { limit } : "skip");
}
