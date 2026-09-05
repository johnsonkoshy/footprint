/**
 * A light brand colour with white text on it is unreadable, and it WILL happen -
 * plenty of brands own a yellow or a mint. Templates never assume; they ask.
 */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever candidate is most readable on `bg`. */
export function pickReadable(bg: string, candidates: string[]): string {
  return candidates.reduce((best, c) =>
    contrastRatio(bg, c) > contrastRatio(bg, best) ? c : best,
  );
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.45;
}

/** Blend two colours. `amount` 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount,
  });
}

/** Push a colour toward black or white, whichever increases contrast against `against`. */
export function deepen(color: string, against: string, amount = 0.22): string {
  return mix(color, isLight(against) ? "#000000" : "#FFFFFF", amount);
}

/**
 * Guarantee a readable pairing. If the best candidate still can't clear `min`,
 * blend it toward black or white until it does.
 */
export function ensureContrast(bg: string, candidates: string[], min = 4.5): string {
  const best = pickReadable(bg, candidates);
  if (contrastRatio(bg, best) >= min) return best;

  const target = isLight(bg) ? "#000000" : "#FFFFFF";
  let out = best;
  for (let step = 0.1; step <= 1.0001; step += 0.1) {
    out = mix(best, target, step);
    if (contrastRatio(bg, out) >= min) return out;
  }
  return target;
}
