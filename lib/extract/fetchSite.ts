import { chromium, type Browser } from "playwright";

/**
 * Everything the marketing audit needs that we can grab for free while the
 * page is already open. Raw and uninterpreted on purpose - lib/strategy/signals
 * turns it into evidence, and does the same job from plain HTML when headless
 * Chrome gets bounced.
 */
export type PageSignalsRaw = {
  /** every absolute href on the page, deduped */
  links: string[];
  /** script src URLs, for marketing-tech fingerprinting */
  scripts: string[];
  /**
   * Every host the page actually talked to while loading. Script tags alone
   * miss anything injected by a tag manager, which is most of modern martech.
   */
  requestHosts: string[];
  /** email inputs anywhere on the page - a proxy for list building */
  emailInputs: number;
  twitterCard: boolean;
  rss: boolean;
};

export const EMPTY_RAW: PageSignalsRaw = {
  links: [],
  scripts: [],
  requestHosts: [],
  emailInputs: 0,
  twitterCard: false,
  rss: false,
};

export type SiteCapture = {
  url: string;
  /** base64 PNG of the homepage, or null if the site bounced us */
  screenshot: string | null;
  title: string;
  description: string;
  ogImage: string | null;
  favicon: string | null;
  /** absolute URLs of <img> tags that look like a logo, best guess first */
  logoCandidates: string[];
  text: string;
  raw: PageSignalsRaw;
  /** true when we got text but no screenshot - extraction quality will suffer */
  degraded: boolean;
  note?: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}

/**
 * Consent modals are the single biggest source of garbage screenshots - a grey
 * overlay across the hero tells the model nothing about the brand. Hide the
 * common ones rather than trying to click through them.
 */
const HIDE_CONSENT = `
  [id*="onetrust" i], [class*="onetrust" i],
  [id*="cookie" i][class*="banner" i], [class*="cookie-banner" i],
  [class*="cookie-consent" i], [id*="cookie-consent" i],
  [id*="cookiebot" i], [class*="cc-window" i], [class*="gdpr" i],
  [aria-label*="cookie" i], dialog[open][class*="consent" i] { display: none !important; }
`;

async function capture(browser: Browser, url: string): Promise<SiteCapture> {
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  // Third-party calls are the honest record of what marketing tech is live.
  const requestHosts = new Set<string>();
  page.on("request", (req) => {
    try {
      requestHosts.add(new URL(req.url()).host);
    } catch {
      /* data: and blob: URLs have no host, which is fine */
    }
  });

  try {
    await page.goto(url, { waitUntil: "load", timeout: 25_000 });
    // Let webfonts swap in and hero animations settle before we photograph it.
    await page.waitForTimeout(1800);
    await page.addStyleTag({ content: HIDE_CONSENT });

    const meta = await page.evaluate(() => {
      const attr = (sel: string, name: string) =>
        document.querySelector(sel)?.getAttribute(name) ?? null;

      const abs = (href: string | null) => {
        if (!href) return null;
        try {
          return new URL(href, document.baseURI).toString();
        } catch {
          return null;
        }
      };

      const logos = Array.from(document.querySelectorAll("img, svg"))
        .filter((el) => {
          const hay = [
            el.getAttribute("src"),
            el.getAttribute("alt"),
            el.getAttribute("class"),
            el.getAttribute("aria-label"),
            el.id,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes("logo") || hay.includes("wordmark");
        })
        .map((el) => abs(el.getAttribute("src")))
        .filter((v): v is string => Boolean(v))
        .slice(0, 5);

      const links = Array.from(document.querySelectorAll("a[href]"))
        .map((a) => abs(a.getAttribute("href")))
        .filter((v): v is string => Boolean(v));

      const scripts = Array.from(document.querySelectorAll("script[src]"))
        .map((s) => abs(s.getAttribute("src")))
        .filter((v): v is string => Boolean(v));

      return {
        title: document.title ?? "",
        description:
          attr('meta[name="description"]', "content") ??
          attr('meta[property="og:description"]', "content") ??
          "",
        ogImage: abs(attr('meta[property="og:image"]', "content")),
        favicon: abs(
          attr('link[rel="icon"]', "href") ??
            attr('link[rel="shortcut icon"]', "href") ??
            attr('link[rel="apple-touch-icon"]', "href"),
        ),
        logoCandidates: logos,
        text: document.body?.innerText ?? "",
        raw: {
          links: Array.from(new Set(links)).slice(0, 400),
          scripts: Array.from(new Set(scripts)).slice(0, 120),
          emailInputs: document.querySelectorAll(
            'input[type="email"], input[name*="email" i], input[placeholder*="email" i]',
          ).length,
          twitterCard: Boolean(document.querySelector('meta[name="twitter:card"]')),
          rss: Boolean(
            document.querySelector(
              'link[type="application/rss+xml"], link[type="application/atom+xml"]',
            ),
          ),
        },
      };
    });

    const screenshot = (await page.screenshot({ type: "png" })).toString("base64");

    return {
      url,
      screenshot,
      title: meta.title,
      description: meta.description,
      ogImage: meta.ogImage,
      favicon: meta.favicon,
      logoCandidates: meta.logoCandidates,
      text: firstWords(meta.text, 2000),
      raw: { ...meta.raw, requestHosts: [...requestHosts].slice(0, 200) },
      degraded: false,
    };
  } finally {
    await context.close();
  }
}

/** Text-only path for sites that bounce headless browsers. Worse, but not nothing. */
async function captureDegraded(url: string, note: string): Promise<SiteCapture> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();
    const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
    const absolute = (href: string | null) => {
      if (!href) return null;
      try {
        return new URL(href, url).toString();
      } catch {
        return null;
      }
    };

    const text = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");

    return {
      url,
      screenshot: null,
      title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? "",
      description:
        pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ?? "",
      ogImage: absolute(
        pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
      ),
      favicon: absolute(pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)),
      logoCandidates: [],
      text: firstWords(text, 2000),
      raw: rawFromHtml(html, url),
      degraded: true,
      note,
    };
  } catch (err) {
    return {
      url,
      screenshot: null,
      title: "",
      description: "",
      ogImage: null,
      favicon: null,
      logoCandidates: [],
      text: "",
      raw: EMPTY_RAW,
      degraded: true,
      note: `${note}; plain fetch also failed: ${String(err)}`,
    };
  }
}

/** The no-browser version of the in-page collector. Same fields, worse recall. */
export function rawFromHtml(html: string, baseUrl: string): PageSignalsRaw {
  const absolute = (href: string) => {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };
  const all = (re: RegExp) =>
    Array.from(html.matchAll(re))
      .map((m) => absolute(m[1]))
      .filter((v): v is string => Boolean(v));

  return {
    links: Array.from(new Set(all(/<a[^>]+href=["']([^"']+)["']/gi))).slice(0, 400),
    scripts: Array.from(new Set(all(/<script[^>]+src=["']([^"']+)["']/gi))).slice(0, 120),
    emailInputs: (html.match(/<input[^>]+(type=["']email["']|name=["'][^"']*email|placeholder=["'][^"']*email)/gi) ?? [])
      .length,
    // A plain fetch never executes anything, so there are no request hosts.
    requestHosts: [],
    twitterCard: /<meta[^>]+name=["']twitter:card["']/i.test(html),
    rss: /<link[^>]+type=["']application\/(rss|atom)\+xml["']/i.test(html),
  };
}

function firstWords(text: string, count: number): string {
  return text.split(/\s+/).filter(Boolean).slice(0, count).join(" ");
}

/**
 * Screenshot + read a homepage. Never throws: a site that blocks headless
 * Chrome comes back `degraded: true` with whatever text we could still get.
 */
export async function fetchSite(rawUrl: string, browser?: Browser): Promise<SiteCapture> {
  const url = normalizeUrl(rawUrl);
  const owned = !browser;
  let b = browser;
  try {
    b ??= await chromium.launch();
    return await capture(b, url);
  } catch (err) {
    return captureDegraded(url, `headless capture failed: ${String(err).slice(0, 200)}`);
  } finally {
    if (owned && b) await b.close();
  }
}

export { chromium };
