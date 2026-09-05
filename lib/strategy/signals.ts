import { EMPTY_SIGNALS, type SiteSignals } from "@/types";
import { normalizeUrl, rawFromHtml, type PageSignalsRaw } from "@/lib/extract/fetchSite";

/**
 * Turns a raw page read into an evidence-based picture of how much marketing
 * this company is already doing. Everything here is observed, never inferred -
 * the model gets told what we saw, and is told plainly when we saw nothing.
 */

/** host fragment -> display name. Ordered: first match wins per link. */
const SOCIAL_PATTERNS: [RegExp, string][] = [
  [/(^|\.)linkedin\.com/i, "LinkedIn"],
  [/(^|\.)(twitter|x)\.com/i, "X"],
  [/(^|\.)instagram\.com/i, "Instagram"],
  [/(^|\.)youtube\.com|youtu\.be/i, "YouTube"],
  [/(^|\.)tiktok\.com/i, "TikTok"],
  [/(^|\.)facebook\.com/i, "Facebook"],
  [/(^|\.)github\.com/i, "GitHub"],
  [/(^|\.)bsky\.app/i, "Bluesky"],
  [/(^|\.)threads\.(net|com)/i, "Threads"],
  [/(^|\.)reddit\.com/i, "Reddit"],
  [/(^|\.)discord\.(gg|com)/i, "Discord"],
  [/(^|\.)t\.me/i, "Telegram"],
  [/(^|\.)pinterest\./i, "Pinterest"],
  [/(^|\.)substack\.com/i, "Substack"],
  [/(^|\.)medium\.com/i, "Medium"],
  [/(^|\.)mastodon\.|joinmastodon/i, "Mastodon"],
  [/(^|\.)slack\.com\/(join|team)/i, "Slack community"],
  [/(^|\.)twitch\.tv/i, "Twitch"],
];

/**
 * Script fingerprints. The category is the diagnostic part: an ads pixel means
 * they are spending money, an experimentation tool means someone is measuring,
 * an email platform means there is a list to nurture.
 */
const MARTECH: [RegExp, string, string][] = [
  [/googletagmanager\.com\/gtm/i, "Google Tag Manager", "tag manager"],
  [/googletagmanager\.com\/gtag|google-analytics\.com/i, "Google Analytics", "analytics"],
  [/plausible\.io/i, "Plausible", "analytics"],
  [/usefathom\.com/i, "Fathom", "analytics"],
  [/cdn\.segment\.com/i, "Segment", "analytics"],
  [/cdn\.mxpnl\.com|mixpanel/i, "Mixpanel", "analytics"],
  [/amplitude\.com/i, "Amplitude", "analytics"],
  [/posthog/i, "PostHog", "analytics"],
  [/static\.hotjar\.com/i, "Hotjar", "session replay"],
  [/fullstory\.com/i, "FullStory", "session replay"],
  [/connect\.facebook\.net/i, "Meta Pixel", "paid ads"],
  [/snap\.licdn\.com/i, "LinkedIn Insight Tag", "paid ads"],
  [/static\.ads-twitter\.com/i, "X Pixel", "paid ads"],
  [/analytics\.tiktok\.com/i, "TikTok Pixel", "paid ads"],
  [/redditstatic\.com\/ads|reddit\.com\/.*pixel/i, "Reddit Pixel", "paid ads"],
  [/googleadservices\.com|googlesyndication/i, "Google Ads", "paid ads"],
  [/js\.hs-scripts\.com|hs-analytics|hsforms/i, "HubSpot", "marketing automation"],
  [/munchkin\.js|marketo/i, "Marketo", "marketing automation"],
  [/klaviyo\.com/i, "Klaviyo", "email"],
  [/chimpstatic\.com|list-manage\.com|mailchimp/i, "Mailchimp", "email"],
  [/customer\.io|braze\.com|iterable\.com/i, "Lifecycle email", "email"],
  [/widget\.intercom\.io/i, "Intercom", "conversational"],
  [/js\.driftt\.com/i, "Drift", "conversational"],
  [/qualified\.com/i, "Qualified", "conversational"],
  [/optimizely\.com/i, "Optimizely", "experimentation"],
  [/visualwebsiteoptimizer/i, "VWO", "experimentation"],
  [/calendly\.com|chilipiper/i, "Meeting booker", "conversion"],
  [/typeform\.com/i, "Typeform", "conversion"],
];

/** The content surfaces worth knowing about. Probed only if not already linked. */
const SURFACES: [string, string[]][] = [
  ["Blog", ["/blog", "/news", "/posts"]],
  ["Changelog", ["/changelog", "/releases", "/whats-new"]],
  ["Customer stories", ["/customers", "/case-studies", "/case-study"]],
  ["Resource library", ["/resources", "/guides", "/library"]],
  ["Newsletter", ["/newsletter", "/subscribe"]],
  ["Events or webinars", ["/events", "/webinars"]],
  ["Podcast or video", ["/podcast", "/videos"]],
  ["Docs", ["/docs", "/documentation", "/developers"]],
];

/** The platform names we are able to detect at all. Anything else is unverifiable. */
export const DETECTABLE_PLATFORMS = SOCIAL_PATTERNS.map(([, name]) => name);

function socialsFrom(links: string[], siteHost: string) {
  const found = new Map<string, string>();
  for (const href of links) {
    let host: string;
    try {
      const u = new URL(href);
      host = u.host;
      // A link to your own domain is not a social presence.
      if (host === siteHost) continue;
      // Bare profile-less links ("linkedin.com") tell us nothing.
      if (u.pathname === "/" || u.pathname === "") continue;
    } catch {
      continue;
    }
    for (const [re, name] of SOCIAL_PATTERNS) {
      if (re.test(host) && !found.has(name)) {
        found.set(name, href);
        break;
      }
    }
  }
  return [...found].map(([platform, url]) => ({ platform, url }));
}

function martechFrom(scripts: string[], requestHosts: string[]) {
  const found = new Map<string, string>();
  const hay = [...scripts, ...requestHosts].join(" ");
  for (const [re, name, category] of MARTECH) {
    if (re.test(hay) && !found.has(name)) found.set(name, category);
  }
  return [...found].map(([name, category]) => ({ name, category }));
}

/**
 * Plenty of SPAs answer 200 for every path. Ask for a URL nobody would have;
 * if that also comes back OK, every probe below is noise and we say so rather
 * than reporting eight content surfaces that do not exist.
 */
async function detectSoftNotFound(origin: string): Promise<boolean> {
  return ok(`${origin}/footprint-probe-${Date.now().toString(36)}`);
}

async function ok(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The free half: everything derivable from a page we already loaded. No
 * network, so extraction can return this without getting slower.
 */
export function signalsFromPage(
  rawUrl: string,
  raw: PageSignalsRaw,
  hasOgImage: boolean,
): SiteSignals {
  let host = "";
  try {
    host = new URL(normalizeUrl(rawUrl)).host;
  } catch {
    return EMPTY_SIGNALS;
  }

  return {
    socials: socialsFrom(raw.links, host),
    surfaces: surfacesFromLinks(rawUrl, raw.links),
    martech: martechFrom(raw.scripts, raw.requestHosts),
    hasNewsletterCapture: raw.emailInputs > 0,
    hasOgImage,
    hasTwitterCard: raw.twitterCard,
    hasRss: raw.rss,
    softNotFound: false,
    degraded: !raw.links.length && !raw.scripts.length,
  };
}

function surfacesFromLinks(rawUrl: string, links: string[]) {
  let host = "";
  try {
    host = new URL(normalizeUrl(rawUrl)).host;
  } catch {
    /* fall through with an empty host: nothing will match, which is correct */
  }

  const paths = new Set(
    links
      .map((h) => {
        try {
          const u = new URL(h);
          return u.host === host ? u.pathname.replace(/\/+$/, "").toLowerCase() : null;
        } catch {
          return null;
        }
      })
      .filter((v): v is string => Boolean(v)),
  );

  return SURFACES.map(([label, candidates]) => {
    const linked = candidates.find((c) => [...paths].some((p) => p === c || p.startsWith(`${c}/`)));
    return {
      label,
      path: linked ?? candidates[0],
      linked: Boolean(linked),
      reachable: Boolean(linked),
    };
  });
}

/**
 * The paid half: HTTP probes for surfaces the homepage does not link to. Runs
 * server-side when the user asks for a plan, not on every extraction. Never
 * throws - a site that refuses probes just keeps the link-only picture.
 */
export async function probeSurfaces(rawUrl: string, signals: SiteSignals): Promise<SiteSignals> {
  let origin: string;
  try {
    origin = new URL(normalizeUrl(rawUrl)).origin;
  } catch {
    return signals;
  }

  // If a page was never read, try once now rather than reporting an empty audit.
  let base = signals;
  if (base.degraded) {
    try {
      const res = await fetch(origin, {
        headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
        signal: AbortSignal.timeout(12_000),
      });
      const html = await res.text();
      base = signalsFromPage(origin, rawFromHtml(html, origin), /og:image/i.test(html));
    } catch {
      return signals;
    }
  }

  const softNotFound = await detectSoftNotFound(origin);
  if (softNotFound) return { ...base, softNotFound };

  const surfaces = await Promise.all(
    base.surfaces.map(async (surface) => {
      if (surface.linked) return surface;
      const candidates = SURFACES.find(([label]) => label === surface.label)?.[1] ?? [surface.path];
      const hit = await firstReachable(origin, candidates);
      return { ...surface, path: hit ?? surface.path, reachable: Boolean(hit) };
    }),
  );

  return { ...base, surfaces, softNotFound };
}

async function firstReachable(origin: string, candidates: string[]): Promise<string | null> {
  for (const path of candidates) {
    if (await ok(`${origin}${path}`)) return path;
  }
  return null;
}

/** Compact, human-readable evidence block for the strategy prompt. */
export function describeSignals(s: SiteSignals): string {
  if (s.degraded) return "We could not read this site's links or scripts. Treat the audit as unverified.";

  const yes = (b: boolean) => (b ? "yes" : "no");
  const surfaces = s.surfaces.filter((f) => f.linked || f.reachable);
  const missing = s.surfaces.filter((f) => !f.linked && !f.reachable);

  const lines = [
    `Social accounts linked from the homepage: ${
      s.socials.length ? s.socials.map((x) => x.platform).join(", ") : "NONE"
    }`,
    `Content surfaces that exist: ${
      surfaces.length
        ? surfaces.map((f) => `${f.label} (${f.linked ? "linked in nav/footer" : "reachable but not linked"})`).join(", ")
        : "NONE FOUND"
    }`,
    `Content surfaces absent: ${missing.length ? missing.map((f) => f.label).join(", ") : "none"}`,
    `Marketing tech on the page: ${
      s.martech.length ? s.martech.map((m) => `${m.name} [${m.category}]`).join(", ") : "NONE DETECTED"
    }`,
    `Email capture on the homepage: ${yes(s.hasNewsletterCapture)}`,
    `Open Graph image set: ${yes(s.hasOgImage)}; Twitter card set: ${yes(s.hasTwitterCard)}; RSS feed: ${yes(s.hasRss)}`,
  ];

  if (s.softNotFound) {
    lines.push(
      "NOTE: this site returns 200 for any URL, so absent content surfaces above are based only on homepage links.",
    );
  }
  return lines.join("\n");
}
