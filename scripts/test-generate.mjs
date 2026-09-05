/**
 * Step 3 gate: same topic, two brands. They should read like two different
 * companies wrote them.
 *
 *   node scripts/test-generate.mjs http://localhost:3000 [--brands=stripe,notion] [--topic="..."]
 */
const base = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:3000";
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const brands = (arg("brands") ?? "stripe,notion").split(",");
const topic = arg("topic") ?? "announcing a new integrations marketplace";

const kits = await fetch(`${base}/api/fixtures`).then((r) => r.json());

console.log(`\nTOPIC: ${topic}\n${"=".repeat(78)}`);

for (const brand of brands) {
  const kit = kits[brand];
  if (!kit) {
    console.log(`\n${brand}: no such fixture (have: ${Object.keys(kits).join(", ")})`);
    continue;
  }
  process.stderr.write(`  generating ${brand} ... `);
  const t0 = Date.now();
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kit, topic }),
  });
  const json = await res.json();
  process.stderr.write(`${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  console.log(`\n\x1b[1m${kit.name.toUpperCase()}\x1b[0m  [${kit.voice.tone}]  \x1b[2m${json.model ?? ""}\x1b[0m`);
  console.log(`must never: ${kit.voice.avoid.join(" | ")}`);
  console.log("-".repeat(78));
  if (json.error || json.usedFallback) {
    console.log(`\x1b[31m${json.error ?? "FALLBACK"} ${(json.notes ?? []).join("; ")}\x1b[0m`);
    continue;
  }
  const c = json.content;
  console.log(`HOOK     ${c.hook}`);
  console.log(`CAPTION  ${c.caption}`);
  c.slides.forEach((s, i) => console.log(`SLIDE ${i + 1}  ${s}`));
  console.log(`TAGS     ${c.hashtags.map((h) => "#" + h).join(" ")}`);
  if (json.notes?.length) console.log(`\x1b[33mNOTES    ${json.notes.join("; ")}\x1b[0m`);
}
console.log(`\n${"=".repeat(78)}`);
console.log("Gate: do these read like different companies? If not, the prompt is too weak.");
