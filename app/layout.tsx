import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Footprint",
  description: "Paste a URL. Get on-brand social content that looks like their designer made it.",
};

export const THEME_COOKIE = "footprint-theme";
export type ThemeChoice = "light" | "dark" | "system";

/**
 * The theme is decided here, on the server, from a cookie. An explicit choice
 * becomes a class on <html> in the HTML itself, so there is no white flash and
 * no script - the earlier inline script made React warn on every client-side
 * navigation that it would never execute. "system" renders no class and the
 * stylesheet follows the OS.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  const choice: ThemeChoice = raw === "light" || raw === "dark" ? raw : "system";
  const themeClass = choice === "system" ? "" : choice;

  return (
    <html
      lang="en"
      data-theme={choice}
      className={`${geistSans.variable} ${geistMono.variable} ${themeClass} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
