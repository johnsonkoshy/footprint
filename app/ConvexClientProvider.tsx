"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * The provider is always mounted, even when Convex is not configured. React
 * hooks cannot be called conditionally, so a missing provider would mean the
 * cache hooks could not be called at all - callers pass Convex's "skip"
 * sentinel instead, and no request is ever made against the placeholder.
 */
const url = process.env.NEXT_PUBLIC_CONVEX_URL || "https://unconfigured.convex.cloud";

const client = new ConvexReactClient(url);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
