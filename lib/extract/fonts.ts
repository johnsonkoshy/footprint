/**
 * Extracted families are almost always proprietary (Söhne, Circular, GT America).
 * We never try to fetch the real file - we classify it and substitute a Google
 * Font with the same skeleton, which is what actually carries brand feel at
 * social-post size.
 */

export type FontClass = "geometric-sans" | "grotesque" | "serif" | "mono";

/** One Google family per class. Keep this list short - each one is a font fetch at render time. */
export const CLASS_TO_GOOGLE: Record<FontClass, string> = {
  "geometric-sans": "Poppins",
  grotesque: "Inter",
  serif: "Playfair Display",
  mono: "JetBrains Mono",
};

/** Families we've seen enough to classify by name rather than by heuristic. */
const KNOWN: Record<string, FontClass> = {
  // geometric
  circular: "geometric-sans",
  "circular std": "geometric-sans",
  futura: "geometric-sans",
  poppins: "geometric-sans",
  montserrat: "geometric-sans",
  gilroy: "geometric-sans",
  avenir: "geometric-sans",
  "avenir next": "geometric-sans",
  "proxima nova": "geometric-sans",
  "century gothic": "geometric-sans",
  brandon: "geometric-sans",
  "sofia pro": "geometric-sans",
  cera: "geometric-sans",
  // grotesque / neo-grotesque
  "sohne": "grotesque",
  "söhne": "grotesque",
  inter: "grotesque",
  helvetica: "grotesque",
  "helvetica neue": "grotesque",
  arial: "grotesque",
  roboto: "grotesque",
  "gt america": "grotesque",
  "gt walsheim": "geometric-sans",
  graphik: "grotesque",
  "neue haas": "grotesque",
  "aeonik": "grotesque",
  "suisse int'l": "grotesque",
  "suisse": "grotesque",
  "basis grotesque": "grotesque",
  "founders grotesk": "grotesque",
  "national": "grotesque",
  "untitled sans": "grotesque",
  "abc diatype": "grotesque",
  "sf pro": "grotesque",
  "system-ui": "grotesque",
  "-apple-system": "grotesque",
  segoe: "grotesque",
  lato: "grotesque",
  "open sans": "grotesque",
  "work sans": "grotesque",
  // serif
  tiempos: "serif",
  georgia: "serif",
  garamond: "serif",
  times: "serif",
  "times new roman": "serif",
  "playfair display": "serif",
  freight: "serif",
  canela: "serif",
  "gt sectra": "serif",
  lyon: "serif",
  "source serif": "serif",
  merriweather: "serif",
  domaine: "serif",
  // mono
  "jetbrains mono": "mono",
  "ibm plex mono": "mono",
  "sf mono": "mono",
  "roboto mono": "mono",
  menlo: "mono",
  monaco: "mono",
  consolas: "mono",
  "berkeley mono": "mono",
  "space mono": "mono",
  "fira code": "mono",
};

/** Substring signals, checked only after an exact lookup misses. */
const HINTS: Array<[RegExp, FontClass]> = [
  [/mono|code|courier|consol/i, "mono"],
  [/serif|slab|times|georgia|garamond|book|didot|bodoni/i, "serif"],
  [/geometric|circular|futura|poppins|gothic|avenir|nova/i, "geometric-sans"],
  [/grotes[kq]|helvetica|arial|inter|neue|sans/i, "grotesque"],
];

export function classifyFont(family: string | null | undefined): FontClass {
  if (!family) return "grotesque";

  // A CSS stack ("Söhne, Helvetica, sans-serif") - judge by the first real name.
  const first = family
    .split(",")[0]
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();

  if (first in KNOWN) return KNOWN[first];

  const whole = family.toLowerCase();
  for (const [key, cls] of Object.entries(KNOWN)) {
    if (first.includes(key) || whole.includes(key)) return cls;
  }
  for (const [re, cls] of HINTS) {
    if (re.test(family)) return cls;
  }
  return "grotesque";
}

/** The Google family we'll actually load and render with. */
export function resolveFont(family: string | null | undefined): {
  requested: string;
  fontClass: FontClass;
  google: string;
} {
  const fontClass = classifyFont(family);
  return {
    requested: (family ?? "").trim() || "unknown",
    fontClass,
    google: CLASS_TO_GOOGLE[fontClass],
  };
}
