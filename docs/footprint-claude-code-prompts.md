# Footprint - Claude Code Prompt Pack

Staged prompts for the one-day POC. Don't paste this whole file. Paste the blocks one at a time, in order, verifying between each.

**Why staged:** a single mega-prompt for a full day's build produces a large pile of unverified code. Six staged prompts with a working checkpoint between each means you catch the extraction schema drifting at hour 1 instead of hour 7.

---

## Step 0 - Create CLAUDE.md before anything else

Paste this into a fresh Claude Code session in an empty directory.

```
Create a CLAUDE.md file in this repo with exactly the content below, then stop. Don't scaffold anything else yet.

---

# Footprint

## What this is
Paste a company's URL. We read their existing visual identity and voice from
their website, then generate on-brand social content that looks like their own
designer made it.

## The one thing that must work
Two different URLs + the same content topic produce two visibly different,
obviously on-brand rendered images. That side-by-side comparison is the entire
proof. Every decision should be evaluated against whether it moves that forward.

## Stack (decided, do not revisit)
- Next.js App Router, TypeScript
- Satori (@vercel/og) for image rendering
- Vision-capable LLM for brand extraction and content generation
- Convex for persistence and reactive queries
- Tailwind for the UI
- Deploy target: Vercel

## Hard rules
1. NO hex color literals in any template component. Every color comes from
   brand.json. If you type a # followed by six characters inside
   /components/templates, you have broken the product.
2. All LLM calls that return structured data use a forced JSON schema, validate
   the result with zod, retry once on failure, then fall back to a default
   rather than throwing.
3. No authentication. The URL is the identity. Do not add login.
4. No new dependencies without telling me what and why first.
5. Two templates. Not three, not six.

## Explicitly out of scope
Auth, MCP integrations, Instagram publishing, scheduling, queues, carousels,
analytics, teams, billing, settings pages, dark mode.

## Build order
1. Extraction: URL -> brand.json
2. Generation: brand.json + topic -> content set
3. Rendering: content set + brand.json -> PNG
4. Viewer: single page tying it together
5. Compare mode: two URLs side by side
6. Stretch: publish to Bluesky

## Working style
- Build one stage at a time. Stop after each and tell me how to verify it.
- Write the smallest thing that works, then harden it against the test URLs.
- When something is ambiguous, pick the option that gets to a working demo
  fastest and tell me what you picked.
- Do not refactor earlier stages while building a later one.
- Do not write tests unless I ask.

## Test URLs
Use these to validate extraction. They range from strongly designed to plain.
stripe.com, linear.app, figma.com, vercel.com, notion.so,
anthropic.com, ramp.com, arc.net, craigslist.org, and one plain local
business site of your choosing.
```

---

## Step 1 - Scaffold

```
Scaffold the project per CLAUDE.md: Next.js App Router with TypeScript and
Tailwind, Convex initialized, Satori installed.

Create the directory structure we'll use:
  /app                    routes
  /lib/extract            brand extraction
  /lib/generate           content generation
  /lib/render             satori rendering
  /components/templates   post templates (NO hex literals in here, ever)
  /convex                 schema and functions
  /types                  shared types

Define the BrandKit type in /types now, since everything depends on it:

  name: string
  tagline: string
  palette: { primary, ink, surface, accent }   // all hex strings
  typography: { display: string, body: string }
  geometry: { radius: number }
  logoUrl: string | null
  imagery: { style: string }
  voice: { tone: string, sample: string, avoid: string[] }

Also define ContentSet:

  hook: string
  caption: string
  slides: string[]        // exactly 4
  hashtags: string[]

Write matching zod schemas for both. Get `npm run dev` working and Convex
connected, then stop and tell me how to verify.
```

---

## Step 2 - Extraction (the wedge, budget 2 hours)

```
Build brand extraction: a URL goes in, a validated BrandKit comes out.

Approach - important, do it this way:
Do NOT parse CSS or count color frequencies. That breaks on CSS-in-JS and
design systems with 40 tokens. Instead:

1. Take a screenshot of the homepage
2. Fetch the raw HTML and pull: title, meta description, og:image, favicon,
   and the first ~2000 words of visible text
3. Send the screenshot AND the text to a vision-capable model in one call,
   with the BrandKit zod schema as a forced output schema
4. Validate, retry once on failure, fall back to a neutral default kit

For the screenshot, pick whichever is faster to get working: local Playwright
or a hosted screenshot API. Tell me which you picked and why. Note that
Cloudflare-fronted sites will often bounce headless browsers, so whatever you
pick needs a graceful failure path.

Font handling: extracted families are usually proprietary (Sohne, Circular,
GT America). Build a small fallback map that classifies the extracted font as
geometric-sans, grotesque, serif, or mono, and maps each to a Google Font we
load. Never try to fetch the real font file.

The extraction prompt matters more than the code. Ask the model to behave like
a brand designer doing an audit: identify the dominant color and its role, the
type classification, the imagery language, and the voice from actual copy on
the page. Have it return concrete sample sentences for voice, not adjectives.

When it works on one URL, run all 10 test URLs from CLAUDE.md and show me the
results in a table. Then stop.
```

**Verify before moving on:** at least 8 of 10 URLs produce a kit you'd actually use. If a well-designed site comes back with a grey palette, the extraction prompt needs work, not the code. Fix it now, because everything downstream inherits the quality.

---

## Step 3 - Generation

```
Build content generation: BrandKit + a topic string in, validated ContentSet out.

One LLM call, forced JSON schema, same validate-retry-fallback pattern.

The system prompt must enforce voice hard. Pass voice.tone, voice.sample, and
voice.avoid as explicit constraints, and instruct the model that voice.avoid is
absolute. The gap between generic output and on-brand output lives entirely
here, so spend your effort on this prompt, not on the plumbing.

Test: generate content for the topic "announcing a new integrations
marketplace" using the Stripe kit and the Notion kit. Show me both outputs
side by side. They should read like two different companies wrote them. If
they don't, the prompt is too weak - iterate before moving on.
```

---

## Step 4 - Rendering (budget 2 hours, this is what judges see)

```
Build Satori rendering: ContentSet + BrandKit -> PNG at 1080x1350.

Exactly two templates in /components/templates:

1. Statement - large display type on a palette.primary background, ink or
   surface for text depending on contrast, logo bottom-left, generous
   negative space.
2. Split - headline on the left over palette.surface, an abstract gradient
   or geometric block on the right built from primary and accent. Logo small,
   top-left.

Both read every single visual value from BrandKit. Repeat: no hex literals in
these files. Also compute text color from background contrast rather than
assuming - a light primary with white text is unreadable and will happen.

Render target under 3 seconds. Expose it as an API route that takes a kit and
a content set and returns a PNG.

When both render, generate the same content set through both templates for
Stripe and for Linear, and show me all four images. Then stop.
```

**Verify before moving on:** would you actually post either image? If not, iterate here. This is the highest-visibility component in the demo and the most common place a POC like this falls flat.

---

## Step 5 - Viewer

```
Build the single-page viewer at /.

Layout, two columns:

Left - URL input, extract button, then the resulting brand kit rendered as
color swatches with hex labels, font names, the logo, and the voice sample.
Each swatch is click-to-edit so I can override a color live.

Right - topic input, generate button, then the rendered post. Template toggle
between Statement and Split. The headline is click-to-edit inline, and editing
it re-renders the image.

Persist kits and content sets in Convex so a refresh doesn't lose state, and
use reactive queries so results appear as they complete.

Extraction takes 20 to 40 seconds. That needs a real progressive loading state
that shows what's happening (screenshotting, reading, analyzing), not a
spinner. Also build the empty state and the extraction-failed state properly.

Stop when the full URL-to-image flow works in the browser.
```

---

## Step 6 - Compare mode (this is the demo, don't skip it)

```
Build /compare - the demo moment.

Two URL inputs side by side, one shared topic input, one generate button.
Extract both kits in parallel, generate content for each, render both, and
display them as two large images next to each other with the brand kit
summarized in a small strip under each.

Optimize this page for being watched on a projector: large images, minimal
chrome, obvious visual difference between the two sides. Add a way to pre-load
a cached pair instantly so I can demo without waiting 40 seconds on stage,
while still being able to run a live URL a judge suggests.

When this works, we have a product.
```

---

## Step 7 - Bluesky (stretch, only if steps 1-6 are done)

```
Add Bluesky publishing. AT Protocol, no OAuth, no approval needed.

Create a session with an app password from env vars, upload the rendered PNG
as a blob, create the post record with the caption as text. Add a publish
button on the viewer that shows the resulting post URL on success and the
actual API error on failure.

Keep it to one file in /lib/publish/bluesky.ts behind a generic interface
shaped like: publish(image: Buffer, text: string) => Promise<{url: string}>.
That interface is what makes adding Instagram tomorrow cheap.
```

---

## Guardrail prompts

Keep these handy. Claude Code drifts on long builds, and these pull it back in one line.

| Situation | Paste this |
|---|---|
| It starts adding auth, settings, or a dashboard | `Check CLAUDE.md out-of-scope. Remove that and get back to the build order.` |
| It's refactoring instead of building | `Stop refactoring. We ship in hours, not weeks. Move to the next stage.` |
| Output looks generic across two brands | `The templates are not reading from brand.json properly. Grep /components/templates for hex literals and show me every match.` |
| It's stuck on a hard problem | `Timebox this to 15 more minutes. If it isn't working, implement the simplest fallback and move on. Tell me what you cut.` |
| It installed something unexpected | `What did you add and why? Per CLAUDE.md rule 4, ask first.` |
| You're behind schedule | `We're behind. Per the cut ladder: drop Bluesky, then the template toggle, then inline editing. Never cut extraction, one good template, or compare mode. What's the fastest path to compare mode working?` |
| It's writing tests | `No tests today. Delete them and continue.` |

---

## Parallel agent note

Steps 3 and 4 are independent of each other once Step 2's BrandKit type is
locked. If you're running multiple Claude Code sessions, that's the clean
split: one on generation, one on templates, both consuming the same type.
Don't parallelize before Step 2 is done, since everything depends on the shape
of BrandKit and a mid-build type change will cost you more than it saves.
