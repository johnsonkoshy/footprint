import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import {
  BrandKitSchema,
  ContentSetSchema,
  type BrandKit,
  type ContentSet,
  type TemplateId,
} from "@/types";
import { buildTheme } from "@/lib/render/theme";
import { loadFonts, familyStack } from "@/lib/render/fonts";
import { FIXTURE_KITS, FIXTURE_CONTENT } from "@/lib/render/fixtures";
import { Statement } from "@/components/templates/Statement";
import { Split } from "@/components/templates/Split";

export const runtime = "nodejs";

const WIDTH = 1080;
const HEIGHT = 1350;

async function render(kit: BrandKit, content: ContentSet, template: TemplateId) {
  const theme = buildTheme(kit, template);
  const fonts = await loadFonts([theme.displayFamily, theme.bodyFamily]);

  // Only claim a family we actually loaded, or Satori renders tofu.
  const resolved = {
    ...theme,
    displayFamily: familyStack(fonts, theme.displayFamily),
    bodyFamily: familyStack(fonts, theme.bodyFamily),
  };

  const element =
    template === "split" ? (
      <Split kit={kit} content={content} theme={resolved} />
    ) : (
      <Statement kit={kit} content={content} theme={resolved} />
    );

  return new ImageResponse(element, { width: WIDTH, height: HEIGHT, fonts });
}

function parseBody(
  body: unknown,
): { kit: BrandKit; content: ContentSet; template: TemplateId } | { error: string } {
  const b = body as { kit?: unknown; content?: unknown; template?: unknown };
  const issues = (e: { issues: { path: PropertyKey[]; message: string }[] }) =>
    e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ");

  const kit = BrandKitSchema.safeParse(b.kit);
  if (!kit.success) return { error: `kit: ${issues(kit.error)}` };

  const content = ContentSetSchema.safeParse(b.content);
  if (!content.success) return { error: `content: ${issues(content.error)}` };

  return {
    kit: kit.data,
    content: content.data,
    template: b.template === "split" ? "split" : "statement",
  };
}

/** GET /api/render?fixture=stripe&template=split - for eyeballing in a browser. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const fixture = params.get("fixture") ?? "stripe";
  const template = (params.get("template") ?? "statement") as TemplateId;

  const kit = FIXTURE_KITS[fixture];
  const content = FIXTURE_CONTENT[fixture];
  if (!kit || !content) {
    return NextResponse.json(
      { error: `Unknown fixture "${fixture}". Try: ${Object.keys(FIXTURE_KITS).join(", ")}` },
      { status: 400 },
    );
  }
  return render(kit, content, template);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = parseBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return render(parsed.kit, parsed.content, parsed.template);
}
