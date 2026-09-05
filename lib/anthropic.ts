import Anthropic from "@anthropic-ai/sdk";

/**
 * The SDK's "Could not resolve authentication method" error is accurate and
 * completely unhelpful when the real answer is "you have no .env.local". Catch
 * that case before we make a call, so the UI can say something useful.
 */
export const MISSING_KEY_MESSAGE =
  "ANTHROPIC_API_KEY is not set. Run `cp .env.local.example .env.local`, add your key, and restart the dev server.";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Model choice per call site. Extraction is vision plus design judgement and is
 * the wedge - everything downstream inherits its quality - so it defaults
 * higher. Generation is a tightly constrained writing task behind a strong
 * prompt, so it defaults to Sonnet.
 *
 * Override either in .env.local. Prices are $ per million tokens, in/out:
 *   claude-opus-5     $5 / $25
 *   claude-sonnet-5   $2 / $10
 *   claude-haiku-4-5  $1 / $5   (still vision-capable)
 */
const ALLOWED = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"] as const;
type AllowedModel = (typeof ALLOWED)[number];

function pick(envValue: string | undefined, fallback: AllowedModel): AllowedModel {
  const v = envValue?.trim();
  if (!v) return fallback;
  if ((ALLOWED as readonly string[]).includes(v)) return v as AllowedModel;
  // A typo here would otherwise fail as an opaque 404 on every request.
  console.warn(`[footprint] Unknown model "${v}". Using ${fallback}. Allowed: ${ALLOWED.join(", ")}`);
  return fallback;
}

export const EXTRACT_MODEL = pick(process.env.EXTRACT_MODEL, "claude-opus-5");
export const GENERATE_MODEL = pick(process.env.GENERATE_MODEL, "claude-sonnet-5");
// Strategy is judgement over evidence we hand it, with no image to read, so it
// sits with generation rather than extraction.
export const STRATEGY_MODEL = pick(process.env.STRATEGY_MODEL, "claude-sonnet-5");

export function getClient(): Anthropic {
  if (!hasApiKey()) throw new Error(MISSING_KEY_MESSAGE);
  return new Anthropic();
}
