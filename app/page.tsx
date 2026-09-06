import Link from "next/link";
import { UrlStart } from "@/components/UrlStart";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = {
  title: "Footprint · On-brand marketing for founders",
  description:
    "Paste your URL. Footprint reads your brand off your own site, works out who buys from you, and writes posts that look like your designer made them.",
};

const STEPS = [
  {
    n: "01",
    title: "Brand",
    body: "We screenshot your homepage and read your colours, type, logo and voice off it. No brand guidelines to upload, no questionnaire.",
  },
  {
    n: "02",
    title: "Market",
    body: "Who actually buys this, which named communities they already sit in, who else sells to them, and the one number that tells you it is working.",
  },
  {
    n: "03",
    title: "Plan",
    body: "Where to post first and how often. You pick the channels and formats; the plan gets rewritten for exactly what you chose.",
  },
  {
    n: "04",
    title: "Post",
    body: "Copy in your voice, set in your type, on your colour, rendered ready to publish.",
  },
];

export default function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-16 px-6 py-16">
      <section className="flex flex-col gap-7">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-ink-soft">Footprint</p>
          <ThemeToggle />
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Marketing that already looks like you, from nothing but your URL.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-soft">
          Built for founders who have a product and a landing page, and no time to become a
          marketer. Paste your address. We read your brand off your own site, work out who buys
          from you, and write posts that look like your designer made them.
        </p>

        <UrlStart />

        <p className="text-sm text-ink-mute">
          Takes about two minutes. Nothing is published without you pressing publish.
        </p>
      </section>

      {/* The proof, before any claim about it: same topic, two brands. */}
      <section className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:max-w-[620px]">
          {/* Bundled fixtures, so this costs no API calls and cannot fail on a demo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/render?fixture=stripe&template=statement"
            alt="A post rendered in Stripe's brand: indigo, their wordmark, their typeface"
            className="w-full rounded-lg shadow-lg ring-1 ring-line/5"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/render?fixture=notion&template=split"
            alt="The same topic rendered in Notion's brand: off-white, serif, hand-drawn feel"
            className="w-full rounded-lg shadow-lg ring-1 ring-line/5"
          />
        </div>
        <p className="max-w-xl text-sm text-ink-soft">
          The same announcement, two companies. Nobody typed a colour or picked a font — both were
          read off the sites. That difference is the whole product.{" "}
          <Link href="/compare" className="text-ink underline underline-offset-2">
            Compare two brands yourself
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-mute">
          What happens when you paste
        </h2>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col gap-2">
              <span className="font-mono text-xs text-ink-mute">{s.n}</span>
              <h3 className="text-base font-medium">{s.title}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-mute">
          What it will not do
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          It will not tell you your positioning is great when your homepage says the same thing as
          everyone else&apos;s. It will not invent competitors it could not find, or set you a
          follower target — a founder with no baseline needs an absolute number and a reason to
          care about it. And it will not post anything on your behalf until you press the button.
        </p>
      </section>
    </main>
  );
}
