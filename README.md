# Footprint

Paste a company's URL. Footprint reads their visual identity and voice off
their homepage, audits the marketing they already have, proposes a plan, and -
once you approve it - writes social posts that look like their own designer
made them.

Built in a day as a hackathon proof of concept. The proof is one comparison:
two different URLs, the same topic, two visibly different, obviously on-brand
images side by side.

## How it works

```
URL ──▶ Brand ──▶ Footprint ──▶ Plan ──▶ Post
        colours    what they    where to  written in their voice,
        type       already do   post,     set in their type,
        logo       (measured)   what to   on their colour
        voice                   write
```

**Brand.** Playwright screenshots the homepage. A vision model audits the
screenshot and the copy like a designer would and returns a `brand.json`:
palette, typography, corner radius, imagery language, and a voice guide with
a real sample sentence and a list of things this company never does. The logo
is photographed off the page as pixels, so inline SVG and webfont wordmarks
work too.

**Footprint.** While the page is open we also record every host it talks to,
every link it renders and every script it loads. That yields the social
accounts they link, the content surfaces that exist (blog, changelog, customer
stories, ...) and the marketing tech actually running - analytics, ad pixels,
marketing automation, email. Measured, not guessed. The model gets it as
evidence.

**Plan.** A maturity verdict, then a ranked channel order with cadence, three
concrete post briefs, two falsifiable experiments, a first quarter, and KPIs
that each name the decision they'd change. Nothing is written until you pick a
brief and press the button.

**Post.** A copywriter prompt that treats the voice guide as absolute, then
Satori renders the result at 1080x1350 using only colours from `brand.json`.
Two templates. Every colour in a template comes from the kit - there are no
hex literals in `components/templates/`, by rule.

## Run it

```bash
npm install
npx playwright install chromium
cp .env.local.example .env.local   # add ANTHROPIC_API_KEY
npm run dev
```

Then paste a URL. `craigslist.org` is the sharpest demo; `stripe.com` and
`tartinebakery.com` show the range. `/compare` puts two brands side by side,
and its **Instant pair** button renders bundled fixtures with no API calls.

Every LLM call uses a forced JSON schema, validates with zod, retries once and
falls back to a neutral default rather than throwing.

## Cost and speed

About 9 cents per brand end to end: extraction on Opus (~5c), the plan on
Sonnet (~3c), generation on Sonnet (~1c). Screenshot and evidence land at ~6s,
the kit at ~17s, the plan 50-90s later. Override models with `EXTRACT_MODEL`,
`STRATEGY_MODEL` and `GENERATE_MODEL`.

## What's deliberately not here

Auth, scheduling, carousels, analytics dashboards, teams, billing, dark mode.
The URL is the identity. Bluesky publishing is wired but needs
`BLUESKY_IDENTIFIER` and `BLUESKY_APP_PASSWORD`; nothing has been posted.

`docs/PROGRESS.md` is the build log - every decision, what was measured, and
what broke.
