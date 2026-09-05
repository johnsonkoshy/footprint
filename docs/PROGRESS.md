# Footprint - Build Tracker

Source of truth for where we are. Updated at the end of every stage.
Prompt pack: `docs/footprint-claude-code-prompts.md`

**North star:** two URLs + one topic -> two visibly different, obviously
on-brand rendered images, side by side.

---

## Status

| # | Stage | State | Gate |
|---|---|---|---|
| 0 | CLAUDE.md | DONE | File exists at repo root |
| 1 | Scaffold + types | IN PROGRESS | `npm run dev` boots, Convex connected |
| 2 | Extraction (URL -> BrandKit) | NOT STARTED | 8 of 10 test URLs give a usable kit |
| 3 | Generation (BrandKit + topic -> ContentSet) | NOT STARTED | Stripe vs Notion read as different companies |
| 4 | Rendering (Satori -> PNG) | NOT STARTED | Would you actually post the image? |
| 5 | Viewer (`/`) | NOT STARTED | Full URL-to-image flow works in browser |
| 6 | Compare mode (`/compare`) | NOT STARTED | Two brands side by side on a projector |
| 7 | Bluesky publish | STRETCH | Only if 1-6 are done |

---

## Decision log

| When | Decision | Why |
|---|---|---|
| Step 0 | Build in `hackathon/marketing/`, prompt pack moved to `docs/` | Scaffold needs a clean root; pack is reference, not source |

---

## Blockers / needs from Johnson

- [ ] **Anthropic API key** - `ANTHROPIC_API_KEY` in `.env.local`. Needed for Steps 2 and 3.
- [ ] **Convex login** - `npx convex dev` opens a browser OAuth flow. Interactive, so Johnson runs it.
- [ ] **Screenshot approach** - local Playwright vs hosted API. Decided at Step 2.

---

## Cut ladder (if behind schedule)

Drop in this order: Bluesky -> template toggle -> inline editing.
**Never cut:** extraction, one good template, compare mode.
