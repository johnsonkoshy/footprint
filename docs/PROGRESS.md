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
| 2 | Extraction | **DONE, GATE PASSED** | **10 of 10** produced a usable kit (bar was 8) |
| 2.5 | **Footprint audit + plan** | **DONE, verified** | Real evidence per site; Stripe reads "advanced", a bakery reads "emerging" |
| 3 | Generation | **DONE, GATE PASSED** | Stripe / Notion / craigslist read as three different companies |
| 4 | Rendering | DONE, verified | Judged four rendered PNGs. Yes, postable |
| 5 | Viewer (`/`) | DONE | Empty, loading, fallback and ready states all seen working |
| 6 | Compare (`/compare`) | DONE, verified | Two brands side by side, screenshotted |
| 7 | Bluesky publish | CODE DONE, unrun | Needs app-password env vars. **Nothing has been posted** |

All eight steps built and verified against real API calls, plus the audit/plan
stage added on top.

### Stage 2.5 - what it does

Between "here are your colours" and "here is a post", the app now audits the
marketing the company already has, proposes a plan, and **waits for the user to
approve it** before writing anything.

The audit is measured, not asked for. While the extraction screenshot is being
taken we also record every host the page talks to, every link it renders, and
every script it loads. That yields:

- **social accounts** they actually link to (18 platforms recognised)
- **content surfaces** that exist - blog, changelog, customer stories, resource
  library, newsletter, events, podcast, docs - linked in nav, or probed by HTTP
- **marketing tech** actually running, grouped by what it implies: analytics,
  paid ads, marketing automation, email, experimentation, conversational
- whether they capture email, set an OG image, set a Twitter card, ship RSS

The model gets that block as EVIDENCE and returns: a maturity call, a headline
verdict, strengths and gaps, 4 ranked channels with cadence, 3 content formats
each carrying a ready-to-write brief, 2 falsifiable experiments, a 3-phase first
quarter, and 3 KPIs that each name the decision they would change.

The user then picks a channel, edits the brief, optionally adds a constraint and
re-plans, and hits **Approve**. Approval is what triggers generation - and the
approved channel and format are passed into the copywriting prompt, so an
Instagram documentary video and an X changelog note are not the same post.

---

## The two blockers, and exactly what they block

- [x] ~~`ANTHROPIC_API_KEY`~~ - set, both gates run and passed.
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
lib/strategy/signals.ts         measured footprint: socials, surfaces, martech, probes
lib/strategy/index.ts           the strategist prompt + the same safety loop
lib/strategy/rebuild.ts         rewrite the plan for the founder's own picks
lib/market/index.ts             audience (fast) + competitors (web search)
components/stages/              Stage shell + Brand, Footprint, Plan, Post cards
components/Canvas.tsx           the sticky right pane: fixtures -> screenshot -> post
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
app/api/{extract,strategy,generate,render,fixtures,publish}
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
| 2.5 | Record every **network host** the page hits, not just `<script src>` | Decisive. Plain HTML said Stripe ran no marketing tech; the request log found Marketo and two ad pixels. Anything a tag manager injects is invisible otherwise |
| 2.5 | Channel `presence` is **computed from evidence**, never asked of the model | In testing it labelled GitHub "absent" while our own scan had just found the link. We can see whether an account is linked; we cannot see whether it is active, so there is no "active" value |
| 2.5 | Soft-404 detection before probing surfaces | SPAs that answer 200 for any path would otherwise manufacture eight content surfaces that do not exist |
| 2.5 | Surface probes run in the **strategy** route, not extraction | Keeps extraction at its measured 14-20s. The free half of the signals rides along with the screenshot |
| 2.5 | Plan starts automatically the moment extraction returns | It takes longer than the extraction did. The user reads the brand panel while it runs instead of waiting twice |
| 2.5 | Approval passes `{channel, format, cadence}` into the copywriter | Otherwise the plan is decoration - the post would read the same whichever channel was picked |
| 7 | `Publisher` interface in its own file | The seam that makes Instagram a new file, not a refactor |
| - | Deleted the scaffold's `prefers-color-scheme` block | CLAUDE.md puts dark mode explicitly out of scope |

---

## Model choice - measured, not guessed

Same five URLs, same prompt, back to back:

| | Opus 5 extraction | Sonnet 5 extraction |
|---|---|---|
| Cost per URL | $0.049 | $0.016 (3.2x cheaper) |
| Time per URL | 19.8s | 12.1s |
| Named a real typeface | 4 of 5 (Söhne, Inter Display, Georgia, Styrene B) | **1 of 5** - four came back as generic "neo-grotesque" |
| anthropic.com primary | `#D97757` - the clay that IS their brand | **`#141413`** - near-black, same as ink |

Sonnet's two failures are the ones that matter most. Collapsing every font to
"neo-grotesque" maps every brand to the same Inter substitute, which erases the
typographic difference the side-by-side demo depends on. And returning near-black
for Anthropic is exactly the failure the prompt warns against - reporting the
background instead of finding the brand colour.

Generation is the opposite story: **Sonnet 5 is plenty**, and it is the default.
Stripe, Notion and craigslist came back in three clearly distinct voices with
every `voice.avoid` rule respected, including craigslist staying all-lowercase.

**Settled:** `claude-opus-5` for extraction (the wedge), `claude-sonnet-5` for
generation. About **5.5 cents per brand**, end to end. Override either with
`EXTRACT_MODEL` / `GENERATE_MODEL` in `.env.local`; unknown values warn and fall
back rather than 404-ing every request.

Full 10-URL Step 2 gate on Opus 5: **10/10 passed, $0.5562 total.**

---

## Stage 2.6 - Market, and who the tool is for

The audience is now fixed: **a very early stage founder.** One or two people, no
marketing hire, a couple of hours a week, no budget. That is a constant in the
prompts, not a setting, and it changes what a good answer looks like - a founder
has no baseline, so every target is absolute and time-boxed ("40 orders/week by
week 6"), never a percentage change.

Footprint says what a company has already built. For a founder that is nearly
always "nothing", which is true but thin. Their real unknowns are who buys this,
who else sells it, and what number proves it works. That is the Market stage,
and it sits **before** the plan - KPIs are not a byproduct of picking a channel,
they constrain the choice. The plan is written against the north star and the
ICP's named hangouts.

### Two calls, because their costs are nothing alike

A single combined call measured **233 seconds**. Splitting it and capping the
search budget got each half under 30:

| | Audience | Competitors |
|---|---|---|
| Web search | none | up to 2 |
| Measured | ~20s | **24.8s** (was 233s) |
| Reads | their own homepage copy | live search results |
| Blocks the plan | yes | no |

The fix for the 233s was budget discipline in the system prompt - "run at most
two searches, then answer immediately, do not verify or cross-check" - plus
`max_uses: 2` and a lower `max_tokens`. Quality held: real competitors with real
URLs.

The two fire together the moment extraction returns, and the plan waits only on
the fast one. Competitor research is the longest call in the app and nothing
downstream needs it, so it lands whenever it lands.

Competitors get one attempt, not two. A retry means a second round of web
searches, which costs more than the rest of the pipeline combined. The prompt
requires every URL to be one actually seen in results, and an empty list with a
reason is the correct answer when search finds nothing - a founder can act on
"nobody is doing this" but is harmed by three plausible companies that do not
exist.

### The founder chooses; the plan follows

The first strategy call proposes. The founder then ticks channels and formats -
seeded from our recommendation, so agreeing costs zero clicks - and a rebuild
writes the plan for exactly what they chose. `/api/plan` is told the choice is
final and not to relitigate it: pick Nextdoor over Instagram and Instagram
disappears from the plan entirely rather than being filtered out of a list.

Verified live on tartinebakery.com: unticking Instagram and ticking Nextdoor
rebuilt to a Reddit + Nextdoor plan with new cadences and experiments.

### What it produced

Positioning refused to flatter: *"Their homepage copy doesn't actually establish
a difference - 'a thoughtful expression of modern craft' is the same line every
artisanal bakery uses. The one real point of difference - that they published the
book that taught home bakers the open-crumb country loaf - is buried under three
competing cake-ordering CTAs."*

North star: Goldbelly shipping orders, 40/week by week 6, with a stated
consequence if it misses. ICP: "Home sourdough baker who owns Tartine Bread and
treats the recipe like scripture", found at r/Sourdough, r/Breadit and The
Perfect Loaf newsletter. The plan then opened on **Reddit** - which follows
directly from those named places, and is not where a generic playbook would send
a bakery.

Cost is now about **18 cents per brand** end to end, up from 9: extraction ~5c,
audience ~3c, competitors ~6c (the web search call is the most expensive), plan
~3c, generation ~1c. Time to a full plan is about 100 seconds, up from 77 - the
market stage adds roughly 23 seconds of wall clock because it overlaps
everything else.

---

## The viewer, redesigned

The first viewer grew one stage at a time and it showed: a linear process -
read, audit, plan, choose, write - laid out spatially as two columns and a
Plan/Post tab. Rebuilt around three principles.

**Story on the left, artifact on the right.** The left column is four stage
cards top to bottom: Brand, Footprint, Plan, Post. Pending ones are dimmed and
dashed, the working one carries a live clock, done ones are plain, so the state
of the process is legible without a spinner. The right column is one sticky
canvas that always shows the brand as it currently exists: what we make (the
Stripe/Notion fixture pair, zero API calls) -> their homepage -> their post.

**Show what you have the moment you have it.** `/api/extract?stream=1` returns
NDJSON: a `capture` line the instant the page is photographed, then the
`result`. Measured on linear.app: screenshot, logo and evidence at **6.0s**,
kit at 16.9s. The screenshot goes on the canvas at 6s in a browser frame; the
Footprint card fills its evidence chips at the same moment, a full minute
before the model's verdict arrives to sit above them. The user reads while the
plan writes.

**Decisions first, rationale folded.** The Plan card leads with one sentence -
"Start on Instagram, 3x/week · then Email, Facebook · skip TikTok" - with the
channel names as clickable picks, then three brief cards, then one button:
"Write this post for Instagram". Choosing the brief and pressing the button is
the approval. Experiments, KPIs and the quarter live under "Why this plan".
"Change the plan" reveals the constraint field and re-runs.

Cut: the Plan/Post tabs, the word "Approve", the Present button. Kept: /compare
as its own page, linked from the top bar - folding it into the canvas is the
next step, not this one.

Copy follows sentence case, verb-first buttons, no exclamation marks. The chrome
is grey on purpose so the extracted brand is the only colour on screen.

---

## Logo capture

The kit now carries the company's actual logo as pixels, not a URL.

`logoUrl` was dead code. The model was asked to pick a logo URL from `<img>`
candidates, and `usableLogo` then accepted only `.png/.jpg`. Measured on the
test URLs: two of three returned `null`, and the one hit was an `.svg`, which
was rejected. So `theme.logoSrc` was always null and every render fell back to
the text wordmark. The cause is structural - most modern sites draw their logo
as inline `<svg>`, which has no URL to fetch at all.

Instead we now find the logo element and photograph it with Playwright, during
the screenshot we were already taking. That works for inline SVG, `<img>`, CSS
backgrounds and webfont wordmarks alike, and yields a transparent PNG that
Satori renders without a network fetch.

Finding it is a scoring pass, not one selector, because "the logo" is a
different element on every site: the masthead home link, an `aria-label`,
something whose class says logo, a child of such a wrapper, or failing all that
the first mark in the top-left. Candidates must be above the fold and shaped
like a logo, must not contain a button or several links, and are ranked by how
high and how far left they sit, plus how tight the crop is.

`logoUrl` is kept as a fallback for the degraded path, which has no browser.

### What broke, and why

| Site | Symptom | Cause |
|---|---|---|
| craigslist | Captured the wordmark *and* the "post an ad" button | `.logo-post-group` is a wrapper. `inner()` fell back to returning the wrapper itself at a higher base score than the child tier, so the wrapper always won |
| craigslist | Then captured "post an ad" alone | The tightness bonus prefers the smaller box, and the button is smaller than the wordmark. Fixed by weighting vertical position above tightness - inside a wrapper the logo sits above what is grouped with it |
| vercel | Nothing captured at all | Two separate timeouts wearing the same disguise. `elementHandle.screenshot` waits for the element to stop moving and vercel's masthead never does; the clip fallback then failed because `animations: "disabled"` *also* waits for animations to settle, and its 8s timeout was short of what the same page needs for fonts |

The vercel miss was invisible for three rounds because the capture swallowed its
own exception. It now records why it failed, and that note reaches the UI.

Sites whose element will not hold still fall back to clipping the page, which
bakes in the header background. Those are flagged `transparent: false` and are
always drawn on a chip, so they read as a lockup rather than a stray rectangle.

### Hit rate

**10 of 10 test URLs** now yield a usable logo, verified by eye:

| Found via | Sites |
|---|---|
| masthead home link | stripe, ramp, tartine, arc, figma, vercel |
| `aria-label` home/logo | linear, notion, anthropic |
| child of a logo wrapper | craigslist |

Capture costs nothing extra - it reuses the page load the screenshot already
needs. Logos come back 0.3-6KB as PNG, so a kit stays small enough for
sessionStorage and for the render POST body. The base64 never reaches an LLM
prompt: extraction returns it, and the generation and strategy prompts only read
name, tagline, imagery and voice.

### The light-logo problem

A white wordmark lifted off a dark masthead vanishes on a light template. We
never read the logo's pixels, so we reason from what it sat on: `background` is
recorded at capture time, and when its lightness disagrees with the template
background, `theme.logoChip` gives the logo back the surface it was drawn for.
Stripe's dark wordmark on the indigo Statement is the visible case.

---

## Stage 2.5 - measured

Three sites, deliberately far apart. Same code, same prompt.

| | stripe.com | tartinebakery.com | craigslist.org |
|---|---|---|---|
| Socials found | GitHub, YouTube | Facebook, Instagram | none |
| Content surfaces | Blog, Customer stories, Resource library | none | none |
| Marketing tech | LinkedIn Insight, X Pixel, **Marketo** | GTM, GA, **Meta Pixel** | none |
| Maturity call | active | emerging | **invisible** |
| Start here | YouTube | Instagram | **RSS** |
| Skip | Twitter/X | TikTok | LinkedIn |

Craigslist is the one that proves the plan is not a template. It came back
"thirty years of not marketing, and the evidence shows it", entirely in
lowercase because that is in their `voice.avoid`, and it opened with RSS
auto-published per listing rather than a social channel. Its content briefs are
category feed notes, scam-pattern safety notices and posting-delay status notes.
No generic playbook produces that answer.

Timing, measured: surface probes 0.2-1.4s. The plan itself 49-92s, scaling with
how much there is to say - Tartine 49s, craigslist 84s, Stripe 92s. It starts
automatically when extraction returns, so the wait overlaps with reading the
brand panel rather than following it.

Cost per brand, end to end: **about 9 cents** - ~5c extraction (Opus), ~3c plan
(Sonnet, ~2.9k in / ~7k out), ~1c generation. Override with `STRATEGY_MODEL`.

Constrained decoding is token-hungry: a 6.5KB plan costs ~7k output tokens,
roughly four times what the same text would cost as free prose. Tightening the
field descriptions cut wall time from 117s to 84-92s but barely moved the token
count. If the plan needs to be faster, the lever is asking for fewer sections,
not shorter ones.

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
- **Tartine's typography came back as "mono"**, which is wrong for a bakery -
  the extraction fell to a bare classification and picked the wrong one. It is
  an extraction-stage issue, not a plan issue, and it does show up in the
  rendered image. Worth a look before demoing that URL.
- **The audit reads their own site, not the wider web.** It answers "what
  marketing has this company built" from first-party evidence. It does not
  search for press mentions, review counts or competitor share of voice. Adding
  the API's web-search tool to the strategy call is the obvious next lever, at
  the cost of another 30-60s.
- The plan is the slowest stage. If a demo is time-boxed, extract first and let
  the plan run while you talk through the brand panel.

---

## Cut ladder

Drop in this order: Bluesky -> template toggle -> inline editing -> experiments
and timeline sections of the plan (keep audit + channels + content briefs).
**Never cut:** extraction, one good template, compare mode.
