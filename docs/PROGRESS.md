# Footprint - Build Tracker

Source of truth for where we are. Updated at the end of every stage.
Prompt pack: `docs/footprint-claude-code-prompts.md`

**North star:** two URLs + one topic -> two visibly different, obviously
on-brand rendered images, side by side.

---

## Status

| # | Stage | State | Gate |
|---|---|---|---|
| 0 | CLAUDE.md | DONE | Exists at repo root, verbatim from the pack |
| 1 | Scaffold + types | DONE* | `npm run dev` serves; *Convex not connected yet |
| 2 | Extraction (URL -> BrandKit) | CODE DONE, UNGATED | 8 of 10 test URLs give a usable kit - **needs ANTHROPIC_API_KEY to run** |
| 3 | Generation (BrandKit + topic -> ContentSet) | NOT STARTED | Stripe vs Notion read as different companies |
| 4 | Rendering (Satori -> PNG) | NOT STARTED | Would you actually post the image? |
| 5 | Viewer (`/`) | NOT STARTED | Full URL-to-image flow works in browser |
| 6 | Compare mode (`/compare`) | NOT STARTED | Two brands side by side on a projector |
| 7 | Bluesky publish | STRETCH | Only if 1-6 are done |

---

## What exists now

```
CLAUDE.md                       governing doc, do not drift from it
lib/extract/fetchSite.ts        Playwright capture + text-only fallback, never throws
lib/extract/fonts.ts            proprietary family -> class -> Google Font
lib/extract/index.ts            the audit prompt + parse/validate/retry/fallback
app/api/extract/route.ts        POST { url } -> BrandKit
scripts/test-extract.mjs        runs the 10 test URLs, prints the table + voice samples
types/index.ts                  BrandKit + ContentSet, zod schemas, fallbacks
convex/schema.ts                kits + posts tables, by_url index
convex/kits.ts                  getByUrl / get / start / setStage
app/layout.tsx                  wraps children in ConvexClientProvider
app/ConvexClientProvider.tsx    no-ops cleanly when Convex isn't provisioned
app/page.tsx                    placeholder, becomes the viewer at Step 5
lib/extract  lib/generate  lib/render  components/templates   (empty, staged)
.env.local.example              ANTHROPIC_API_KEY, NEXT_PUBLIC_CONVEX_URL
.claude/launch.json             dev server config, autoPort on
```

Versions: Next 16.3.4, React 19.2.8, Tailwind 4, convex 1.45.0, zod 4.5.4.

---

## Decision log

| When | Decision | Why |
|---|---|---|
| 0 | Build in `hackathon/marketing/`, pack moved to `docs/` | Scaffold needs a clean root; pack is reference, not source |
| 1 | Use `next/og` for rendering, not a separate `satori` install | Next 16 bundles Satori. Zero new deps. Fall back to `satori` + `@resvg/resvg-js` only if Step 4 fights us |
| 1 | Only new deps: `convex`, `zod` | Both named in the CLAUDE.md stack, so pre-approved under hard rule 4 |
| 1 | Dev server on an auto-assigned port | Port 3000 is occupied by another project on this machine |
| 1 | Convex provider no-ops without a URL | Lets `npm run dev` boot before Convex login, so Step 1 isn't blocked on it |
| 2 | Local Playwright for screenshots | Johnson's call. Measured: 10/10 test URLs capture cleanly, no Cloudflare bounces |
| 2 | Test harness hits the real `/api/extract` route, not a standalone script | Exercises the production path and avoids adding `tsx` as a dev dependency |
| 2 | LLM gets a *loose* schema; strict `BrandKitSchema` validates the reply | Grammar-constrained decoding and regex don't always mix. The guarantee comes from validating, per hard rule 2 |
| 2 | Kept `waitUntil: "load"` + 1.8s settle; rejected scroll-to-lazy-load | Measured: scrolling changed word counts 462->462, 130->130, 419->419 and made vercel.com 3x slower |
| 2 | Local business test URL = `tartinebakery.com` | `swanoysterdepot.us` is now a domain-squatted gambling site; Tartine verified live at 427 words |
| 2 | Model `claude-opus-5` via `messages.parse` + `zodOutputFormat` | Vision + structured output in one call, adaptive thinking on by default |

---

## Blockers / needs from Johnson

- [ ] **Convex login** - `npx convex dev` opens browser OAuth. Interactive, so
      you run it. Until then `convex/_generated/` is missing, which means
      `npm run build` fails on `convex/kits.ts`. `npm run dev` is unaffected.
- [ ] **`ANTHROPIC_API_KEY`** in `.env.local`. **This is the live blocker** - Step 2's
      code is written but has never made a real call, so the extraction prompt is
      unvalidated. Everything downstream inherits its quality.
- [x] ~~Screenshot approach~~ - local Playwright, verified 10/10 on the test URLs.

---

## Cut ladder (if behind schedule)

Drop in this order: Bluesky -> template toggle -> inline editing.
**Never cut:** extraction, one good template, compare mode.

---

## Measured facts (so we stop re-deriving them)

Headless capture against the 10 test URLs, 1440x900, Chrome UA:

| Site | Capture | Secs | Words of copy |
|---|---|---|---|
| stripe.com | ok | 6.1 | 1679 |
| linear.app | ok | 3.1 | 1383 |
| figma.com | ok | 3.0 | 462 |
| vercel.com | ok | 12-36 | 130 |
| notion.so | ok | 5.1 | 348 |
| anthropic.com | ok | 6.1 | 419 |
| ramp.com | ok | 4.9 | 1370 |
| arc.net | ok | 3.8 | 391 |
| craigslist.org | ok | 3.8 | 482 |
| tartinebakery.com | ok | 4.4 | 427 |

Watch items: **vercel.com** is both the slowest (12-36s, highly variable) and the
thinnest on copy (130 words), so it's the most likely of the ten to produce a weak
voice. If we need a tiebreak later, it's the one to drop.
