import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { ThemeProvider, prepaintScript } from "@rgc-labs/ui/system";
import "./globals.css";

// The "geist" pairing resolves to var(--rgc-face-geist, Geist) and pairs with
// JetBrains Mono. The token layer names the faces; delivering them is the app's
// job, so both are self-hosted here and bound to those seams in globals.css.
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "RGC Asset Library",
  description:
    "Browse the RGC brand asset library and copy commit-pinned CDN urls that never break.",
};

const defaults = { theme: "rgc", density: "normal", mode: "system", font: "geist" } as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: prepaintScript({ defaults, readStoredPreferences: false }),
          }}
        />
      </head>
      <body>
        {/* This app owns its appearance — there is no picker — so storage is
            neither read nor written. Without this, a viewer who visited while the
            defaults were compact/system would keep those forever. */}
        <ThemeProvider {...defaults} persistPreferences={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
