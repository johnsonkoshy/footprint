import type { BrandKit, ContentSet } from "@/types";
import type { RenderTheme } from "@/lib/render/theme";
import { fitDisplaySize } from "@/lib/render/theme";

/**
 * Statement: the hook carries the whole frame on the brand's own colour.
 * Every value here comes from `theme` or `kit`. No literals - hard rule 1.
 */
export function Statement({
  kit,
  content,
  theme,
}: {
  kit: BrandKit;
  content: ContentSet;
  theme: RenderTheme;
}) {
  const hook = content.hook || kit.tagline || kit.name;
  const size = fitDisplaySize(hook, { max: 104, min: 58, widthPx: 888 });

  return (
    <div
      style={{
        width: "1080px",
        height: "1350px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.bg,
        padding: "96px",
        fontFamily: theme.bodyFamily,
      }}
    >
      {/* Void up top - the negative space the brief asks for. */}
      <div style={{ display: "flex", flexGrow: 1 }} />

      {/* Eyebrow: a short accent rule, the brand's radius applied to it. */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
        <div
          style={{
            display: "flex",
            width: "112px",
            height: "10px",
            backgroundColor: theme.accentDecor,
            borderRadius: `${Math.min(theme.radius, 5)}px`,
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: theme.displayFamily,
            fontWeight: 700,
            fontSize: `${size}px`,
            lineHeight: 1.04,
            letterSpacing: "-0.033em",
            color: theme.text,
          }}
        >
          {hook}
        </div>

        {content.slides[0] ? (
          <div
            style={{
              display: "flex",
              marginTop: "44px",
              maxWidth: "760px",
              fontSize: "31px",
              lineHeight: 1.45,
              color: theme.muted,
            }}
          >
            {content.slides[0]}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexGrow: 0.5 }} />

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          // A long tagline used to run left underneath the logo. The logo holds
          // its width; the tagline gives way and stays on its own side.
          gap: "32px",
        }}
      >
        {theme.logoSrc ? (
          // theme.logoChip is set only when the captured logo would vanish
          // against this background - it gives the logo back the surface it
          // was drawn for. Colour comes from the theme; hard rule 1 holds.
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              ...(theme.logoChip
                ? {
                    backgroundColor: theme.logoChip,
                    padding: "14px 20px",
                    borderRadius: `${Math.min(theme.radius, 10)}px`,
                  }
                : {}),
            }}
          >
            {/* Satori renders this, not the browser - next/image does not apply. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={theme.logoSrc}
              height={46}
              style={{ height: "46px", objectFit: "contain" }}
              alt=""
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              fontFamily: theme.displayFamily,
              fontWeight: 700,
              fontSize: "34px",
              letterSpacing: "-0.02em",
              color: theme.text,
            }}
          >
            {kit.name}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexShrink: 1,
            maxWidth: "560px",
            fontSize: "23px",
            lineHeight: 1.35,
            textAlign: "right",
            color: theme.muted,
          }}
        >
          {kit.tagline}
        </div>
      </div>
    </div>
  );
}
