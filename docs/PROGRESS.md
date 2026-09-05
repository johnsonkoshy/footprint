# Footprint - Build Tracker

Source of truth for where we are. Prompt pack: `docs/footprint-claude-code-prompts.md`

**North star:** two URLs + one topic -> two visibly different, obviously
on-brand rendered images, side by side. **This works today** (see `/compare`).

---

## Status

| # | Stage | State | Gate |
|---|---|---|---|
| 0 | CLAUDE.md | DONE | Verbatim from the pack |
| 1 | Scaffold + types | DONE | `npm run dev` and `npm run build` both pass |
| 2 | Extraction | CODE DONE, **UNGATED** | 8/10 test URLs give a usable kit - **needs API key** |
| 3 | Generation | CODE DONE, **UNGATED** | Stripe vs Notion read as different companies - **needs API key** |
| 4 | Rendering | DONE, verified | Judged four rendered PNGs. Yes, postable |
| 5 | Viewer (`/`) | DONE | Empty, loading, fallback and ready states all seen working |
| 6 | Compare (`/compare`) | DONE, verified | Two brands side by side, screenshotted |
| 7 | Bluesky publish | CODE DONE, unrun | Needs app-password env vars. **Nothing has been posted** |

Everything the API key blocks is written and typechecked; it has just never
made a real call. Everything else has been run and looked at.

---

## The two blockers, and exactly what they block

- [ ] **`ANTHROPIC_API_KEY` in `.env.local`** - blocks the Step 2 and Step 3
      gates. Without it `/api/extract` returns a neutral fallback kit after
      ~5s (capture succeeds, the model call fails twice, fallback serves).
      The UI shows an amber warning when this happens, which is how we know
      the failure path works.
- [ ] **`npx convex dev`** - browser OAuth, so it has to be you. Schema and
      functions are written in `convex/`. The viewer currently persists to
      `sessionStorage` instead, so a refresh doesn't lose 40 seconds of work.

Optional: `BLUESKY_IDENTIFIER` + `BLUESKY_APP_PASSWORD` for Step 7. The publish
button only appears once the server sees both.

---

## Verify it yourself

```
npm run dev
```

- `/compare` -> **Instant pair** renders Stripe vs Notion with zero API calls.
- `/api/render?fixture=notion&template=split` -> a PNG in the browser.
  Fixtures: stripe, linear, notion, craigslist. Templates: statement, split.

Once the key is in:

```
node scripts/test-extract.mjs http://localhost:PORT     # Step 2 gate, table + voice samples
node scripts/test-generate.mjs http://localhost:PORT    # Step 3 gate, Stripe vs Notion
```

---

## What exists

```
CLAUDE.md                       governing doc
types/index.ts                  BrandKit + ContentSet, zod schemas, fallbacks
lib/extract/fetchSite.ts        Playwright capture + text-only fallback, never throws
lib/extract/fonts.ts            proprietary family -> class -> Google Font
lib/extract/index.ts            the audit prompt + parse/validate/retry/fallback
lib/generate/index.ts           voice-enforcing prompt + the same safety loop
lib/render/contrast.ts          WCAG luminance, ratio, ensureContrast
lib/render/theme.ts             all colour maths, so templates stay literal-free
lib/render/fonts.ts             Google TTF fetch for Satori, falls back to Inter
lib/render/fixtures.ts          4 hand-written kits + content, for offline work
lib/publish/index.ts            Publisher interface - the Instagram seam
lib/publish/bluesky.ts          AT Protocol session -> uploadBlob -> createRecord
lib/client.ts                   shared browser calls + the staged-progress table
components/templates/           Statement, Split - zero hex literals, checked
components/KitPanel.tsx         swatches with live colour override
app/Viewer.tsx                  the single-page viewer
app/compare/Compare.tsx         the demo
app/api/{extract,generate,render,fixtures,publish}
convex/schema.ts, convex/kits.ts, convex/tsconfig.json
scripts/test-extract.mjs, scripts/test-generate.mjs
```

---

## Decision log

| When | Decision | Why |
|---|---|---|
| 0 | Build in `hackathon/marketing/`, pack moved to `docs/` | Scaffold needs a clean root |
| 1 | `next/og` for rendering, no separate `satori` install | Next 16 bundles Satori. Zero new deps |
| 1 | Convex provider no-ops without a URL | Lets `npm run dev` boot before Convex login |
| 2 | Local Playwright | Measured: 10/10 test URLs capture, no Cloudflare bounces |
| 2 | Harness hits the real API route, not a standalone script | Exercises production path, avoids a `tsx` dep |
| 2 | LLM gets a loose schema; strict `BrandKitSchema` validates the reply | Grammar-constrained decoding and regex don't reliably mix |
| 2 | Kept `waitUntil: "load"`; **rejected** scroll-to-lazy-load | Measured: word counts unchanged (462->462, 130->130), vercel 3x slower |
| 2 | Local business URL = `tartinebakery.com` | `swanoysterdepot.us` is now a domain-squatted gambling site |
| 2,3 | `claude-opus-5` via `messages.parse` + `zodOutputFormat` | Vision + structured output in one call |
| 3 | `coerceKit` / slide padding before validation | Don't burn a retry on `#abc` or an off-by-one array |
| 4 | Separate `theme.accent` (text-grade) from `theme.accentDecor` | Contrast-forcing decoration crushed Stripe's cyan to grey. Decoration needs to be *visible*, not legible |
| 4 | `fitDisplaySize` caps on the longest unbreakable word | "tab-switching" was breaking across lines at 106px |
| 4 | Colour maths lives in `lib/render/theme.ts` | Makes hard rule 1 structural rather than a thing to remember |
| 5 | `sessionStorage` instead of Convex, for now | Convex login is blocked on you; the Convex code is written and waiting |
| 5 | Stage labels driven by measured timings | Real numbers from the capture probe, not a spinner |
| 7 | `Publisher` interface in its own file | The seam that makes Instagram a new file, not a refactor |
| - | Deleted the scaffold's `prefers-color-scheme` block | CLAUDE.md puts dark mode explicitly out of scope |

---

## Measured facts

Headless capture, 1440x900, Chrome UA, all 10 test URLs:

| Site | Capture | Secs | Words |
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

Render: 1080x1350, ~0.6-2.9s cold (Google font fetch), **0.03-0.15s warm**.
Target was under 3s.

---

## Watch items

- **vercel.com** is the slowest (12-36s, highly variable) and thinnest on copy
  (130 words). Most likely of the ten to produce a weak voice. First to drop.
- **Stripe `#635BFF` and Linear `#5E6AD2` are nearly the same indigo.** They are
  a poor pair for the side-by-side. `/compare` defaults to **Stripe vs Notion**
  (indigo grotesque vs black serif) because that difference reads from the back
  of a room. Craigslist is the strongest contrast if you want a third.
- Nothing has been posted to Bluesky. The button is wired but unrun.

---

## Cut ladder

Drop in this order: Bluesky -> template toggle -> inline editing.
**Never cut:** extraction, one good template, compare mode.
