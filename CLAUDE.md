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
