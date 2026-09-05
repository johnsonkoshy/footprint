/**
 * Satori needs real font bytes. Google's CSS endpoint hands back woff2 to modern
 * browsers and plain TTF to old ones, so we ask as an old one.
 */

const LEGACY_UA = "Mozilla/5.0";

type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function fetchFamilyWeight(family: string, weight: 400 | 700): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const task = (async (): Promise<ArrayBuffer | null> => {
    try {
      const cssUrl =
        `https://fonts.googleapis.com/css2?family=` +
        `${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weight}`;

      const css = await fetch(cssUrl, {
        headers: { "user-agent": LEGACY_UA },
        signal: AbortSignal.timeout(10_000),
      }).then((r) => (r.ok ? r.text() : ""));

      const src = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
      if (!src) return null;

      const res = await fetch(src, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch {
      return null;
    }
  })();

  cache.set(key, task);
  return task;
}

/**
 * Load the display and body families at 400 and 700. Anything that fails to
 * fetch silently falls back to Inter rather than failing the render - a post in
 * the wrong typeface still demos; a 500 does not.
 */
export async function loadFonts(families: string[]): Promise<LoadedFont[]> {
  const wanted = Array.from(new Set([...families, "Inter"]));
  const weights: Array<400 | 700> = [400, 700];

  const results = await Promise.all(
    wanted.flatMap((family) =>
      weights.map(async (weight) => {
        const data = await fetchFamilyWeight(family, weight);
        return data ? ({ name: family, data, weight, style: "normal" } as LoadedFont) : null;
      }),
    ),
  );

  const loaded = results.filter((f): f is LoadedFont => f !== null);

  // Satori throws with an empty font list; Inter at 400 is the floor.
  if (loaded.length === 0) {
    const fallback = await fetchFamilyWeight("Inter", 400);
    if (fallback) {
      return [{ name: "Inter", data: fallback, weight: 400, style: "normal" }];
    }
  }
  return loaded;
}

/** Families actually present in the loaded set, for building a CSS stack. */
export function familyStack(loaded: LoadedFont[], preferred: string): string {
  const has = loaded.some((f) => f.name === preferred);
  return has ? preferred : "Inter";
}
