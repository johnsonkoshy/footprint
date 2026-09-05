import type { Publisher, PublishResult } from "./index";

const HOST = "https://bsky.social";
const MAX_GRAPHEMES = 300;

type Session = { accessJwt: string; did: string; handle: string };
type BlobRef = { $type: "blob"; ref: { $link: string }; mimeType: string; size: number };

async function xrpc<T>(
  path: string,
  init: { body: BodyInit; contentType: string; token?: string },
): Promise<T> {
  const res = await fetch(`${HOST}/xrpc/${path}`, {
    method: "POST",
    headers: {
      "content-type": init.contentType,
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body,
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  if (!res.ok) {
    // Surface the real AT Protocol error - "InvalidRequest: ..." is far more
    // useful on stage than a generic failure.
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = [j.error, j.message].filter(Boolean).join(": ") || text;
    } catch {
      /* keep raw */
    }
    throw new Error(`${path} failed (${res.status}): ${detail}`);
  }
  return JSON.parse(text) as T;
}

/** Bluesky counts graphemes, not bytes. Trim on a word boundary if we can. */
function fit(text: string): string {
  const chars = Array.from(text.trim());
  if (chars.length <= MAX_GRAPHEMES) return text.trim();
  const cut = chars.slice(0, MAX_GRAPHEMES - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > MAX_GRAPHEMES - 60 ? cut.slice(0, lastSpace) : cut}…`;
}

export const bluesky: Publisher = {
  name: "Bluesky",

  isConfigured() {
    return Boolean(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD);
  },

  async publish(image: Buffer, text: string): Promise<PublishResult> {
    const identifier = process.env.BLUESKY_IDENTIFIER;
    const password = process.env.BLUESKY_APP_PASSWORD;
    if (!identifier || !password) {
      throw new Error("Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in .env.local");
    }

    const session = await xrpc<Session>("com.atproto.server.createSession", {
      body: JSON.stringify({ identifier, password }),
      contentType: "application/json",
    });

    const { blob } = await xrpc<{ blob: BlobRef }>("com.atproto.repo.uploadBlob", {
      body: new Uint8Array(image) as unknown as BodyInit,
      contentType: "image/png",
      token: session.accessJwt,
    });

    const record = await xrpc<{ uri: string; cid: string }>("com.atproto.repo.createRecord", {
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: fit(text),
          createdAt: new Date().toISOString(),
          embed: {
            $type: "app.bsky.embed.images",
            images: [{ alt: fit(text).slice(0, 120), image: blob }],
          },
        },
      }),
      contentType: "application/json",
      token: session.accessJwt,
    });

    // at://did:plc:xxx/app.bsky.feed.post/RKEY -> the human URL
    const rkey = record.uri.split("/").pop();
    return { url: `https://bsky.app/profile/${session.handle}/post/${rkey}` };
  },
};
