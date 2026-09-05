import type { BrandKit, TemplateId } from "@/types";
import { ensureContrast, isLight, mix, contrastRatio } from "./contrast";
import { resolveFont } from "@/lib/extract/fonts";

/**
 * All colour maths happens here so the template components stay declarative and
 * literal-free. A template reads `theme.text`; it never computes it and never
 * types a hex value. That is hard rule 1, enforced by construction.
 */
export type RenderTheme = {
  bg: string;
  text: string;
  /** Same hue as text, dropped in emphasis for secondary lines. */
  muted: string;
  /** Rule/divider colour that reads on bg without shouting. */
  hairline: string;
  /** Accent forced to be readable on bg - for anything text-sized. */
  accent: string;
  /**
   * Accent for rules, dots and blocks. Decoration only has to be *visible*, not
   * legible, so this keeps the brand hue instead of being crushed toward grey
   * the way text-grade contrast forcing does.
   */
  accentDecor: string;
  gradientFrom: string;
  gradientTo: string;
  radius: number;
  displayFamily: string;
  bodyFamily: string;
  /** Raster logo we're willing to hand Satori, else null and we set a wordmark. */
  logoSrc: string | null;
  /**
   * A backing colour for the logo, set only when the captured logo would
   * disappear against `bg` - a white wordmark lifted off a dark masthead and
   * dropped onto a light surface. null means place it bare.
   */
  logoChip: string | null;
};

/**
 * Prefer the logo we photographed ourselves: it is already a PNG, it is already
 * transparent, and it needs no network fetch at render time. The model-supplied
 * URL stays as a fallback, still restricted to formats Satori decodes reliably
 * - SVG and webp are a coin flip.
 */
function usableLogo(kit: BrandKit): string | null {
  if (kit.logo?.dataUri) return kit.logo.dataUri;
  if (!kit.logoUrl) return null;
  try {
    const path = new URL(kit.logoUrl).pathname.toLowerCase();
    return /\.(png|jpg|jpeg)$/.test(path) ? kit.logoUrl : null;
  } catch {
    return null;
  }
}

/**
 * We never read the logo's pixels, so we reason from what it sat on instead: a
 * logo lifted off a dark masthead is almost certainly light-coloured, and will
 * vanish on a light background. When the two disagree, give it back the
 * background it was designed for.
 */
function logoChipFor(kit: BrandKit, bg: string): string | null {
  const captured = kit.logo;
  if (!captured) return null;
  // A clipped capture carries its own background already, so it needs the chip
  // regardless - otherwise it reads as a stray rectangle.
  if (!captured.transparent) return captured.background;
  if (isLight(captured.background) === isLight(bg)) return null;
  return captured.background;
}

export function buildTheme(kit: BrandKit, template: TemplateId): RenderTheme {
  const { primary, ink, surface, accent } = kit.palette;

  // Statement lives on the brand colour. Split lives on the page colour.
  const bg = template === "statement" ? primary : surface;

  const text = ensureContrast(bg, [surface, ink], 4.5);
  const muted = mix(text, bg, 0.32);
  const hairline = mix(text, bg, 0.75);

  // The accent has to survive being placed on bg, and stay distinct from text.
  const accentReadable = ensureContrast(bg, [accent, primary, ink, surface], 3);
  const accentIsMuddy = contrastRatio(accentReadable, text) < 1.35;
  const accent2 = accentIsMuddy ? mix(accentReadable, bg, 0.4) : accentReadable;

  // Decoration ladder: keep the real accent if you can see it at all, then the
  // primary, then give up and use the text colour.
  const VISIBLE = 1.7;
  const accentDecor =
    contrastRatio(accent, bg) >= VISIBLE
      ? accent
      : contrastRatio(primary, bg) >= VISIBLE
        ? primary
        : mix(text, bg, 0.45);

  // The Split block wants two colours that clearly differ from each other.
  const gradientFrom = primary;
  const gradientTo =
    contrastRatio(primary, accent) > 1.3
      ? accent
      : mix(primary, isLight(primary) ? ink : surface, 0.45);

  return {
    bg,
    text,
    muted,
    hairline,
    accent: accent2,
    accentDecor,
    gradientFrom,
    gradientTo,
    radius: kit.geometry.radius,
    displayFamily: resolveFont(kit.typography.display).google,
    bodyFamily: resolveFont(kit.typography.body).google,
    logoSrc: usableLogo(kit),
    logoChip: logoChipFor(kit, bg),
  };
}

/**
 * Long hooks need to step down or they wrap into mush at 1080px. Returns px.
 */
export function fitDisplaySize(
  text: string,
  opts: { max: number; min: number; widthPx: number },
): number {
  const len = text.trim().length;
  const longestWord = text
    .trim()
    .split(/[\s-]+/)
    .reduce((n, w) => Math.max(n, w.length), 0);

  if (len <= 16) return opts.max;
  const t = Math.min(1, (len - 16) / (86 - 16));
  let size = opts.max + (opts.min - opts.max) * t;

  // A single long word can't be broken, so it sets its own ceiling.
  const perChar = 0.56; // rough advance width of a bold grotesque, in em
  size = Math.min(size, opts.widthPx / (longestWord * perChar));

  return Math.round(Math.max(opts.min, size));
}
