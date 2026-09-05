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
| 2 | Extraction (URL -> BrandKit) | NEXT | 8 of 10 test URLs give a usable kit |
| 3 | Generation (BrandKit + topic -> ContentSet) | NOT STARTED | Stripe vs Notion read as different companies |
| 4 | Rendering (Satori -> PNG) | NOT STARTED | Would you actually post the image? |
| 5 | Viewer (`/`) | NOT STARTED | Full URL-to-image flow works in browser |
| 6 | Compare mode (`/compare`) | NOT STARTED | Two brands side by side on a projector |
| 7 | Bluesky publish | STRETCH | Only if 1-6 are done |

---

## What exists now

```
CLAUDE.md                       governing doc, do not drift from it
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

---

## Blockers / needs from Johnson

- [ ] **Convex login** - `npx convex dev` opens browser OAuth. Interactive, so
      you run it. Until then `convex/_generated/` is missing, which means
      `npm run build` fails on `convex/kits.ts`. `npm run dev` is unaffected.
- [ ] **`ANTHROPIC_API_KEY`** in `.env.local`. Blocks Step 2 entirely.
- [ ] **Screenshot approach** - local Playwright vs hosted API. Decide at Step 2.

---

## Cut ladder (if behind schedule)

Drop in this order: Bluesky -> template toggle -> inline editing.
**Never cut:** extraction, one good template, compare mode.
