/**
 * Runs the CLAUDE.md test URLs through the real /api/extract route and prints
 * the table Step 2 asks for.
 *
 *   node scripts/test-extract.mjs [baseUrl] [--only=stripe.com,linear.app]
 */
const TEST_URLS = [
  "stripe.com",
  "linear.app",
  "figma.com",
  "vercel.com",
  "notion.so",
  "anthropic.com",
  "ramp.com",
  "arc.net",
  "craigslist.org",
  "tartinebakery.com", // the plain local business site (verified live)
];

const base = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : process.env.BASE_URL ?? "http://localhost:3000";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7)?.split(",");
const urls = only?.length ? only : TEST_URLS;

const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);
const swatch = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `\x1b[48;2;${r};${g};${b}m  \x1b[0m`;
};

const rows = [];
for (const url of urls) {
  process.stderr.write(`  extracting ${url} ... `);
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/api/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    rows.push({ url, ...json, secs: ((Date.now() - t0) / 1000).toFixed(1) });
    process.stderr.write(
      `${json.usedFallback ? "FALLBACK" : "ok"}${json.degraded ? " (no screenshot)" : ""} ${((Date.now() - t0) / 1000).toFixed(1)}s\n`,
    );
  } catch (err) {
    rows.push({ url, error: String(err), secs: ((Date.now() - t0) / 1000).toFixed(1) });
    process.stderr.write(`ERROR ${String(err).slice(0, 80)}\n`);
  }
}

console.log(
  "\n" +
    pad("URL", 26) +
    pad("NAME", 16) +
    "PALETTE  " +
    pad("DISPLAY -> GOOGLE", 30) +
    pad("RAD", 5) +
    pad("SECS", 6) +
    "STATUS",
);
console.log("-".repeat(110));

for (const r of rows) {
  if (r.error) {
    console.log(pad(r.url, 26) + `\x1b[31m${r.error.slice(0, 70)}\x1b[0m`);
    continue;
  }
  const p = r.kit.palette;
  console.log(
    pad(r.url, 26) +
      pad(r.kit.name, 16) +
      [p.primary, p.ink, p.surface, p.accent].map(swatch).join("") +
      " " +
      pad(`${r.fonts.display.requested} -> ${r.fonts.display.google}`, 30) +
      pad(r.kit.geometry.radius, 5) +
      pad(r.secs, 6) +
      (r.usedFallback ? "\x1b[31mFALLBACK\x1b[0m" : r.degraded ? "\x1b[33mno screenshot\x1b[0m" : "\x1b[32mok\x1b[0m"),
  );
}

console.log("\n--- VOICE SAMPLES ---");
for (const r of rows) {
  if (r.error || r.usedFallback) continue;
  console.log(`\n${r.url}  [${r.kit.voice.tone}]`);
  console.log(`  "${r.kit.voice.sample}"`);
  console.log(`  avoid: ${r.kit.voice.avoid.join(" | ")}`);
  console.log(`  imagery: ${r.kit.imagery.style}`);
}

const good = rows.filter((r) => !r.error && !r.usedFallback).length;
console.log(`\n${good} of ${rows.length} produced a kit. Gate is 8 of 10.`);
