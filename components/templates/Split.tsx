import type { BrandKit, ContentSet } from "@/types";
import type { RenderTheme } from "@/lib/render/theme";
import { fitDisplaySize } from "@/lib/render/theme";

/**
 * Split: type on the left over the page colour, an abstract block on the right
 * built only from the brand's primary and accent. No literals - hard rule 1.
 */
export function Split({
  kit,
  content,
  theme,
}: {
  kit: BrandKit;
  content: ContentSet;
  theme: RenderTheme;
}) {
  const hook = content.hook || kit.tagline || kit.name;
  const size = fitDisplaySize(hook, { max: 74, min: 42, widthPx: 492 });
  const points = content.slides.filter(Boolean).slice(0, 3);

  return (
    <div
      style={{
        width: "1080px",
        height: "1350px",
        display: "flex",
        flexDirection: "row",
        backgroundColor: theme.bg,
        fontFamily: theme.bodyFamily,
      }}
    >
      {/* Left: the words. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "624px",
          padding: "80px 56px 80px 76px",
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
              height={38}
              style={{ height: "38px", objectFit: "contain" }}
              alt=""
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              fontFamily: theme.displayFamily,
              fontWeight: 700,
              fontSize: "27px",
              letterSpacing: "-0.02em",
              color: theme.text,
            }}
          >
            {kit.name}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: theme.displayFamily,
              fontWeight: 700,
              fontSize: `${size}px`,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: theme.text,
            }}
          >
            {hook}
          </div>

          <div
            style={{
              display: "flex",
              width: "84px",
              height: "8px",
              marginTop: "40px",
              backgroundColor: theme.accentDecor,
              borderRadius: `${Math.min(theme.radius, 4)}px`,
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", marginTop: "40px" }}>
            {points.map((point, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "9px",
                    height: "9px",
                    marginTop: "13px",
                    marginRight: "18px",
                    backgroundColor: theme.accentDecor,
                    borderRadius: `${Math.min(theme.radius, 5)}px`,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    width: "412px",
                    fontSize: "25px",
                    lineHeight: 1.4,
                    color: theme.muted,
                  }}
                >
                  {point}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: "21px", color: theme.muted }}>
          {kit.tagline}
        </div>
      </div>

      {/* Right: an abstract block in the brand's own two colours. */}
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "456px",
          height: "1350px",
          backgroundImage: `linear-gradient(150deg, ${theme.gradientFrom} 0%, ${theme.gradientTo} 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "232px",
            left: "-132px",
            width: "264px",
            height: "264px",
            backgroundColor: theme.bg,
            opacity: 0.14,
            borderRadius: `${Math.max(theme.radius * 2, 132)}px`,
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "690px",
            left: "128px",
            width: "300px",
            height: "300px",
            backgroundColor: theme.bg,
            opacity: 0.1,
            borderRadius: `${Math.max(theme.radius, 2)}px`,
            transform: "rotate(18deg)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: "1104px",
            left: "-64px",
            width: "180px",
            height: "180px",
            backgroundColor: theme.bg,
            opacity: 0.16,
            borderRadius: `${Math.max(theme.radius * 2, 90)}px`,
          }}
        />
      </div>
    </div>
  );
}
