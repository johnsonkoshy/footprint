import { chromium, type Browser, type Page } from "playwright";

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

/**
 * The logo as pixels, not as a URL. Most sites draw their logo as inline <svg>
 * or a CSS background, so there is no image URL to fetch - and the ones that do
 * expose a URL usually point at an .svg, which Satori decodes unreliably.
 * Screenshotting the element sidesteps both problems and works for webfont
 * wordmarks too.
 */
export type LogoCapture = {
  /** data:image/png;base64,... - transparent background */
  dataUri: string;
  width: number;
  height: number;
  /** What it sat on, so a template can tell a white logo from a black one. */
  background: string;
  /**
   * False when we had to clip the page instead of shooting the element, which
   * bakes the header background in. Such a logo must always be shown on that
   * background or it clashes with whatever it is placed on.
   */
  transparent: boolean;
  /** Which strategy found it. Useful when a capture looks wrong. */
  how: string;
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
  /** null when we could not find anything logo-shaped above the fold */
  logo: LogoCapture | null;
  /** Why `logo` is null, when it is. Distinct from `note`, which is about the page. */
  logoNote?: string;
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


const LOGO_MARK = "data-footprint-logo";

/**
 * Find the logo, mark it, photograph it. Scoring rather than a single selector,
 * because "the logo" is a different element on every site: an <a href="/"> in a
 * header, an inline <svg>, an <img>, or a div with a background image.
 */
async function captureLogo(
  page: Page,
  notes: string[],
): Promise<LogoCapture | null> {
  const found = await page.evaluate((MARK) => {
    const toHex = (rgb: string): string | null => {
      const m = rgb.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(",").map((v) => parseFloat(v.trim()));
      // Fully transparent tells us nothing; keep walking up the tree.
      if (parts.length > 3 && parts[3] === 0) return null;
      return (
        "#" +
        parts
          .slice(0, 3)
          .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      );
    };

    const backgroundBehind = (el: Element): string => {
      let node: Element | null = el;
      while (node) {
        const hex = toHex(getComputedStyle(node).backgroundColor);
        if (hex) return hex;
        node = node.parentElement;
      }
      return "#FFFFFF";
    };

    const seen = new Set<Element>();
    const scored: { el: Element; score: number; how: string }[] = [];

    const consider = (el: Element | null, base: number, how: string) => {
      if (!el || seen.has(el)) return;
      seen.add(el);

      const r = el.getBoundingClientRect();
      // Above the fold, and shaped like a logo rather than a banner or a pixel.
      if (r.top < -40 || r.top > 260) return;
      if (r.width < 16 || r.height < 8) return;
      if (r.width > 520 || r.height > 140) return;
      const ratio = r.width / r.height;
      if (ratio > 14 || ratio < 0.25) return;
      if (getComputedStyle(el).visibility === "hidden") return;

      // A box holding a button or several links is a masthead, not a logo.
      // craigslist's element with class "logo" wraps both the wordmark and the
      // "post an ad" button, and photographing the pair looks like a mistake.
      if (el.querySelector("button, input") || el.querySelectorAll("a").length > 1) return;

      // Prefer the top-left corner, where wordmarks live. Height matters more
      // than horizontal position: inside a wrapper the logo sits above the
      // things grouped with it, which is what separates craigslist's wordmark
      // from the "post an ad" link directly beneath it.
      const fromLeft = Math.max(0, 120 - r.left / 8) / 120;
      const fromTop = (Math.max(0, 200 - Math.max(0, r.top)) / 200) * 1.5;
      const position = fromLeft + fromTop;
      // Among plausible candidates, the tighter crop is nearly always the logo
      // itself rather than a container that happens to hold it.
      const tightness = 1 - Math.min(r.width * r.height, 40_000) / 40_000;
      scored.push({ el, score: base + position + tightness * 1.5, how });
    };

    // No `?? el` fallback: returning the wrapper here would score it above the
    // child tier below, which is how craigslist kept winning with a box that
    // included its "post an ad" button.
    const inner = (el: Element | null): Element | null =>
      el ? el.querySelector("svg, img") : null;

    // Strongest signal first: the home link in the masthead.
    for (const sel of [
      'header a[href="/"]',
      'nav a[href="/"]',
      'a[href="/"]',
      `header a[href="${location.origin}"]`,
      `header a[href="${location.origin}/"]`,
      'header a[href="/home"]',
    ]) {
      const el = document.querySelector(sel);
      consider(inner(el), 10, sel);
      consider(el, 8, sel);
    }
    for (const sel of ['[aria-label*="home" i]', '[aria-label*="logo" i]']) {
      consider(inner(document.querySelector(sel)), 9, sel);
    }
    // Then anything that calls itself a logo.
    for (const el of Array.from(document.querySelectorAll(
      '[class*="logo" i], [id*="logo" i], [class*="wordmark" i], [data-testid*="logo" i]',
    )).slice(0, 12)) {
      consider(inner(el), 7, "class/id contains logo");
      consider(el, 6, "class/id contains logo");
      // Wrappers get named "logo" too. craigslist's .logo-post-group holds the
      // wordmark AND the "post an ad" button; the wordmark is a child of it.
      for (const child of Array.from(el.children).slice(0, 4)) {
        consider(child, 6.5, "child of a logo wrapper");
      }
    }
    // Last resort: the first image-ish thing in the masthead.
    for (const sel of ["header svg", "header img", "nav svg", "nav img"]) {
      consider(document.querySelector(sel), 4, sel);
    }
    // Catch-all, structure-independent. vercel.com has no a[href="/"], no
    // top-of-page aria-label, and its mark is a bare <svg> whose ancestors
    // carry no logo-ish class - but it is still the first glyph top-left.
    if (!scored.length) {
      for (const el of Array.from(document.querySelectorAll("svg, img")).slice(0, 40)) {
        const r = el.getBoundingClientRect();
        if (r.top > 120 || r.left > 400) continue;
        consider(el, 2, "first mark in the top-left");
        if (scored.length) break;
      }
    }

    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    document.querySelectorAll(`[${MARK}]`).forEach((n) => n.removeAttribute(MARK));
    best.el.setAttribute(MARK, "1");
    const r = best.el.getBoundingClientRect();
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
      background: backgroundBehind(best.el),
      how: best.how,
    };
  }, LOGO_MARK);

  if (!found) {
    notes.push("no logo: nothing logo-shaped found above the fold");
    return null;
  }

  try {
    const el = await page.$(`[${LOGO_MARK}]`);
    if (!el) {
      notes.push("no logo: marked element vanished before the screenshot");
      return null;
    }
    let png: Buffer;
    let transparent = true;
    try {
      png = await el.screenshot({
        omitBackground: true, // so it can sit on any template colour we choose
        type: "png",
        animations: "disabled",
        timeout: 5000,
      });
    } catch {
      // An element screenshot waits for the element to stop moving, and some
      // mastheads never do - vercel.com times out every time. Clipping the page
      // has no stability wait. The cost is that we get the header background
      // baked in, so the logo is no longer transparent and must be chipped.
      // No `animations` option here: waiting for animations to settle is the
      // very thing that just timed out. A plain clip does not wait at all.
      png = await page.screenshot({
        type: "png",
        clip: { x: found.x, y: found.y, width: found.width, height: found.height },
        // The full-page shot in capture() succeeds on the same page with the
        // default 30s, so this only ever failed for being impatient.
        timeout: 20_000,
      });
      transparent = false;
      notes.push("logo clipped from the page: the element would not hold still");
    }
    const dataUri = `data:image/png;base64,${png.toString("base64")}`;
    // A logo big enough to bloat every payload is not worth carrying.
    if (dataUri.length > 400_000) {
      notes.push(`no logo: capture was ${Math.round(dataUri.length / 1024)}KB, over the budget`);
      return null;
    }
    // x/y were only needed for the clip fallback; they are not part of the asset.
    return {
      dataUri,
      transparent,
      width: found.width,
      height: found.height,
      background: found.background,
      how: found.how,
    };
  } catch (err) {
    notes.push(`no logo: screenshot failed - ${String(err).slice(0, 120)}`);
    return null;
  }
}

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

    // Before the full-page shot: marking the element does not disturb layout,
    // but taking it first keeps the two screenshots independent.
    const logoNotes: string[] = [];
    const logo = await captureLogo(page, logoNotes);

    const screenshot = (await page.screenshot({ type: "png" })).toString("base64");

    return {
      url,
      screenshot,
      title: meta.title,
      description: meta.description,
      ogImage: meta.ogImage,
      favicon: meta.favicon,
      logoCandidates: meta.logoCandidates,
      logo,
      text: firstWords(meta.text, 2000),
      raw: { ...meta.raw, requestHosts: [...requestHosts].slice(0, 200) },
      degraded: false,
      logoNote: logoNotes[0],
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
      logo: null,
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
      logo: null,
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
