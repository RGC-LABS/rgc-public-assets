import type { Metadata } from "next";
import { ThemeProvider, prepaintScript } from "@rgc-labs/ui/system";
import "./globals.css";

export const metadata: Metadata = {
  title: "RGC Asset Library",
  description:
    "Browse the RGC brand asset library and copy commit-pinned CDN urls that never break.",
};

const defaults = { theme: "rgc", density: "compact", mode: "system", font: "system" } as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prepaintScript({ defaults }) }} />
      </head>
      <body>
        <ThemeProvider {...defaults}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
