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

export function getClient(): Anthropic {
  if (!hasApiKey()) throw new Error(MISSING_KEY_MESSAGE);
  return new Anthropic();
}
