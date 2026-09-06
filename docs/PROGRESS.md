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
- [x] ~~`npx convex dev`~~ - done. Deployment `wandering-tiger-755`, caching live.
      `sessionStorage` stays as the same-tab fast path; Convex is the one that
      survives a new tab, a new browser, and a different machine.

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
components/Canvas.tsx           the right pane: fixtures -> screenshot -> post
components/UrlStart.tsx         the landing page's front door
app/page.tsx                    landing
app/build/page.tsx              the wizard
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

## Week one, and the generic control

Asked to look at the market and build something better. The survey, with
sources in the commit that added this section:

| Who | What they do | What reviewers say |
|---|---|---|
| SocialPost.ai, Apaya, Semrush Social AI | URL -> on-brand posts, visuals, "100+ ideas a day" | Volume; brand read is a scrape, not an audit |
| AdCreative.ai | URL -> ad creatives | Billing dark patterns dominate reviews; output "generic, repetitive"; limited customisation |
| Predis.ai | prompts/product links -> posts and video | Cluttered UI, credit burn, "stock-heavy" templates, slow support |
| Canva Brand Kit from URL | colours/fonts/logos off a site | Canva's own docs: custom fonts unavailable, anti-scraping breaks it, "always review" |
| Brandfetch, brand.dev, logo.dev | brand data APIs | A database or a shallow scrape; no voice, no judgement |
| Jasper, Copy.ai, Typeface | brand-voice copy | Voice drifts back to generic; heavy setup; "outputs from different tools are eerily similar" |
| Piktochart, Venngage, m1-project, founderpal | plan / ICP generators | Forms you fill in; disconnected from brand and from output |

Four failures recur across the whole field, in reviewers' words: **generic
output** ("you could put any logo on it"), **shallow extraction**, **volume
over judgement**, and **no provenance** - nobody shows why. Footprint already
answers three of those by construction: evidence is measured and shown, the
pipeline is chained URL -> brand -> buyer -> plan -> post, and the voice guide
is enforced with an explicit avoid list. Where it fell short of the market: it
wrote **one post**, when every competitor writes sets; and it **claimed** to be
on-brand without ever proving it.

### Week one

From the approved plan, one post per format the founder ticked, all written in
parallel, all rendered, presented as a strip in the Ship step. Selecting one
puts it on the stage; editing it edits that entry; the whole week exports as
markdown for a scheduler or a notes app. Cadence is not parsed from the plan's
prose - a post per chosen format is the honest unit, and the cadence line sits
above the strip for the founder to apply.

Pictures are effect-driven: any entry with copy and no image gets one, which
covers posts that landed while another was selected and a restored session,
where object URLs did not survive. A template change clears every thumbnail.

### The generic control

Beside each post: the same topic written by a capable copywriter with exactly
what a URL-level tool has - name, tagline, topic, platform - and none of the
voice guide. Not a strawman; this is the market's actual setup. A toggle puts
the generic draft on the stage in the same template, which is the
swap-the-logo test made visible. Each post carries a fidelity readout - how
many of the mechanically testable voice rules it held - and the control
carries its own, so "4/4 held" sits beside "generic draft holds 2/4".

Only rules `breaks()` can evaluate count: exclamation marks and quoted
forbidden words. The readout says how many were checkable rather than implying
every rule was verified.

Deferred: per-platform aspect ratios. They would be the same two templates at
different sizes, but that brushes hard rule 5 closely enough to ask first.

Cost per week of three posts: about 5 cents - three on-brand writes, three
controls, six renders.

---

## The instrument

Asked for "futuristic, from a founder's perspective". The trap in that brief:
neon, glass and glowing HUD lines would fight every brand we render - Notion's
cream serif inside a cyberpunk shell - and the product's one principle is that
the chrome stays grey so the brand is the only colour. So the redesign earns
the feeling through precision and behaviour, not decoration. The reference is
an instrument, not a form.

**Mono for what was measured, sans for what was reasoned.** Two utilities,
`label` and `readout`, both Geist Mono. Every hex, timing, count, target,
cadence and URL is a readout; every section name is a label; positioning,
rationale and briefs stay in the sans. The typeface itself tells a founder
which parts are fact and which are judgement.

**A live log instead of skeletons.** `RunLog` shows the process narrating
itself with real elapsed times - `00:06 homepage captured · 2 social · 3
surfaces · marketo`, `00:17 palette read · #635BFF · söhne`, `01:04 plan
written · active · youtube first`. Every line is an event that happened, at the
second it happened. The last entry can be live, marked with the one non-grey in
the chrome. This is the single biggest contributor to the feel.

**The stage takes the brand's own surface.** The canvas is tinted with the
brand primary at 10% - the one deliberate place brand colour touches the
chrome. Stripe's stage is faintly indigo, Tartine's faintly amber.

**No cards.** Hairline rules and mono labels; a left rule marks the chapter
asking for a decision and the selected brief. Content sits on the page.

**Founder verbs.** Read · Know · Decide · Ship replaces Brand / Market / Plan
/ Post - what you do at each step, not what the tool emits.

Kept: the one-screen wizard, canvas beside, decisions-first plan, both themes.
A reskin plus two behaviours, not another architecture rewrite.

### What the compiler caught

`runExtract`, a plain render-scope function, wrote a ref and called
`Date.now()`; and `primary`, the footer action, was an IIFE executed during
render whose closures reached `mark`, which read the clock ref - so the
compiler attributed a ref read to render. Turning the IIFE into a conditional
chain moved the error without removing it, because the object still carried a
ref-reaching handler into JSX. The real fix removed the ref: the run's start
time lives inside the log state and elapsed is computed in the updater.
Nothing render can reach touches a ref.

### The theme script went, and the warning turned out not to be ours

A React error - "encountered a script tag while rendering" - appeared on every
client-side navigation, and it first showed up during the dark-mode work, so I
blamed the inline theme script. Moving that to `next/script` did not help.
Removing the script entirely did not help either: with zero scripts of ours in
the source or in the RSC payload, the same error fires twice navigating to
`/compare`, a page nothing that day had touched. The only scripts in the body
are Next's own `__next_f` flight chunks and the Turbopack HMR client. It is
Next 16.3.4 dev-mode noise under React 19.2.8, not something in this app.

The theme change stands on its own merits regardless. An explicit choice is a
cookie; the root layout reads it on the server and renders the class straight
onto `<html>`, so there is no flash and nothing to run before paint. "Auto" is
pure CSS via `prefers-color-scheme`. With nothing of ours mutating `<html>`,
`suppressHydrationWarning` lost its justification and is gone again; the
extension-attribute mismatch it would also have hidden remains the browser
extension's doing.

Lesson recorded for the third time this session: a symptom that appears
alongside a change is not evidence the change caused it. Remove the suspect
and re-measure before believing the story.

Contrast was re-measured in both modes after the restyle. The step numerals
and the log timestamps had drifted to `ink-faint`, a line colour, and measured
2.6-2.8:1; both moved to `ink-mute`. One apparent failure - the theme toggle at
2.06:1 in light - was a sampling artefact from mid-transition; it reads 7.73:1
settled.

---

## Dark mode

CLAUDE.md lists dark mode as explicitly out of scope. Built on request anyway;
that line in CLAUDE.md is now stale.

It was a token swap, not a recolour. The chrome was already deliberately
greyscale so the extracted brand is the only colour on screen, which meant the
whole app named about a dozen grey roles and nothing else. Those roles are now
CSS variables with one light value and one dark value - `surface`, `raised`,
`sunken`, `line`, `ink`, `ink-soft`, `ink-mute`, and so on - registered in
Tailwind's `@theme` so components say `bg-surface` and `text-ink` and never a
grey directly. Semantic banners (warn, ok, danger, info) got the same
treatment, with tinted near-blacks in dark rather than the light ramp, because
a pale banner on a dark page glows and pulls the eye off the brand artwork.

**Brand colours are never themed.** Swatches, the logo chip, the rendered post
and the brand canvas come from `brand.json` via inline styles and look
identical in both modes. They are the product.

Switching is class-based on `<html>` with a three-way toggle (auto, light,
dark) that persists to localStorage. An inline script in `layout.tsx` applies
the class before first paint so a dark-mode user never sees a white flash. That
script is what makes `suppressHydrationWarning` on `<html>` genuinely
necessary: the server markup and client DOM legitimately differ there, and the
attribute suppresses one level only, so real mismatches inside `<body>` still
surface.

Contrast was measured, not eyeballed: a script walked every text node and
computed its WCAG ratio against its effective background. The first dark pass
had `ink-mute` at 3.67:1 on evidence chips and the URL - under AA for small
text - so the dark ink ramp was lightened until nothing on screen fell below
4.5.

### The bug it exposed

Switching to dark to test the Market card found it in its pending state on a
brand that had a full audience cached. Not a theming bug: the sessionStorage
restore had never restored `audience`, `competitors` or `siteText` - a patch
from the wizard rewrite had silently missed its target string - and because
the restore claimed the run, the Convex hydration that would have supplied them
never got asked. Worse, the save effect then wrote `null` over the good values,
poisoning the session. Same read-bug-becomes-write-bug shape as the channel
picks earlier.

Two fixes. The restore now restores all three. And it no longer claims the
run: the Convex effect prefers the cache, which is at least as complete and
gets topped up by `fillGaps`, and only skips extraction - the expensive step -
when a session already produced a kit. A poisoned session now repairs itself on
the next load.

Every replacement in this pass was asserted against the file afterwards. Three
silent no-op patches in one session is a pattern, not bad luck.

---

## Convex, as a cache

Deployment: `wandering-tiger-755` (project `footprint`). The CLI needed its own
device grant - being signed into convex.dev in a browser is not the same thing -
via `npx convex login --no-open --login-flow poll`, which prints a code instead
of demanding a paste.

**One row per company, keyed by normalised URL.** The URL is the identity, so
there is nothing else to key on and nothing user-specific to protect. A cold run
costs about 17 cents and two minutes; the same URL a second time now costs
nothing and lands in about six seconds. Measured on tartinebakery.com: cache hit
restored kit, signals, copy, audience and plan, skipped straight to the Plan
step, and made zero API calls.

Writes happen **from the browser as each stage resolves**, not from the API
routes. Two reasons: there is no auth in this product so there are no server
credentials to thread through, and a run abandoned halfway still leaves every
stage it did finish in the cache. Each write is fire-and-forget so a cache
failure can never break the run that produced the data - but it is logged, not
swallowed, which matters (below).

The research fields are `v.any()` on purpose. Every one is already validated by
a zod schema at the API boundary, and mirroring those shapes in Convex
validators would be a second copy of the contract to keep in sync for no added
safety.

### The screenshot does not go in

A stripe.com capture is **828KB** as a data URI - five times what I estimated,
and most of Convex's 1MB document cap for a field the cache-hit path never
renders, because a hit skips straight past "reading it now". Dropping it takes
the row from ~850KB to ~25KB.

This was worth catching for a second reason: the write was fire-and-forget with
a silent `catch`, so a document-too-large rejection would have shown up as a
cache that simply never hit, with nothing in the console. Failures are logged
now.

A cache hit therefore has a brand but no screenshot, and the canvas used to show
the "paste yours" fixture pitch beside it, which reads as nonsense next to a
brand we clearly already have. There is a `brand` canvas mode now: the logo on
their own surface colour with their palette.

### "Redo the plan" looked broken because it was silent

Reported as doing nothing. It was running the whole time - for sixty to ninety
seconds - with no sign of it anywhere on screen.

`planStatus` tested `plan ? "done"` before `planning ? "working"`, so a redo
kept rendering the existing plan as finished. No `replanning` prop reached
PlanStage either, so the button never changed and the constraint field closed
itself the moment it was submitted. Every visible signal said nothing had
happened.

The old plan now stays on screen but dims, the field stays open, the button
reads "Redoing…", and a line says the plan below is the old one. Same shape as
the rebuild bar - a slow action must say it is running or it reads as a dead
button.

The constraint was also not binding. The prompt took it as background under a
heading saying "what they want out of this", while the rules above it told the
model to pick channels from the buyer's named places. It is now a CONSTRAINT
block that explicitly outranks the model's judgement: name a channel and it
appears at start-here or next even if the model disagrees, rule one out and it
disappears, give a time budget and every cadence has to fit it.

Verified on tartinebakery.com with "drop Reddit entirely and use Instagram as
the main channel": Reddit vanished from the plan, Instagram became start-here at
two posts a week, and the content briefs regenerated as reels.

### A cached row can be honestly incomplete

Competitor research takes 25-60 seconds and the row is marked `ready` the moment
the plan lands, so closing the tab in that window leaves a row that says ready
but has never had competitors looked up. Restoring it showed "No competitors
found", which is a lie: we never looked.

Traced by watching the row field by field during an undisturbed run - the write
path was fine all along (`comp=true` at 63s, `cents=17`), the earlier gap came
from reloading mid-flight during a test.

Two fixes. `fillGaps` runs after a cache hit and fetches whatever is missing -
competitors, audience, or the plan - and saves it, so the cache heals itself
instead of serving a permanent hole. And the UI now distinguishes `null`
(never searched) from an empty list (searched, found nothing), because those
are completely different facts to show a founder.

Verified: loading a row that lacked competitors showed "Searching the web…",
persisted the result, and the next load was a complete hit at 17¢.

### Migrating a cache is deleting it

Removing `screenshot` from the schema was rejected because the existing row
still had the field. For a cache the answer is not a migration - the data is
rebuildable - so the fix was a throwaway `clearAll` mutation, run once, then
removed. Worth remembering that the live browser tab keeps writing while you do
this: the first attempt failed again because a run finished mid-migration.

---

## Landing page and the wizard

`/` is now a landing page and the app moved to `/build`. The landing is not a
gate in front of the product: its URL field is the app's front door, and
submitting hands the address straight to `/build?url=...`, which starts the run
on arrival. Pasting once is the whole interaction.

The four stages became a wizard on a single screen. The old scroll made the
process legible but meant the artifact and the decision were rarely visible at
the same time, and a long Market step pushed everything else off-screen. Now:

- a fixed header carrying identity, the stepper, and a way out
- one step at a time, in a column that scrolls internally
- the canvas beside it, always visible, never moving
- a fixed footer with Back, what is still pending, and the one action worth taking

The page itself never scrolls (verified: `scrollHeight === innerHeight`). The
trick is `min-h-0` on the flex and grid children - without it the column refuses
to scroll and stretches the document instead.

Five cards became four steps: Footprint folds in above Market, since "what
marketing you have" and "who it is for" are both answering where you stand today.

**The view follows the work forward until the user navigates, then stays put.**
`step` is derived - `pinnedStep ?? furthest` - rather than synced in an effect,
so there is no second render and no frame where the two disagree. Pressing
"write this post" pins step 4; starting a new company unpins.

### Three bugs the rewrite exposed

- **The dirty bar was always on.** Two definitions of "we recommend this"
  disagreed: the selection was seeded from `start-here | next`, while the
  dirty check compared against `!== skip`. Any plan containing a "later"
  channel therefore read as edited the instant it arrived. Both now use one
  `isRecommended` predicate. The chips had the same flaw in words - "later" and
  "skip" both rendered as "we'd skip", which is different advice.
- **A refresh lost the founder's picks**, and then the save effect wrote the
  empty selection back over the good one - a read bug becoming a write bug on
  the next render. The picks are persisted now, and fall back to reseeding from
  the plan when an older session lacks them.
- **A refresh re-ran the whole extraction.** The restore effect and the
  auto-start effect run in the same commit, so the second one still saw
  `kit === null` and paid for the site again. It reads sessionStorage directly
  instead of the state it cannot yet see.

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
