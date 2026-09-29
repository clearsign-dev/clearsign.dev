import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from this site, so
// no request reaches Google when the page loads.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const description =
  "Review Safe and supported EVM transactions locally. ClearSign decodes signed fields, recomputes hashes and reports risks and unknowns. Developer preview.";

export const metadata: Metadata = {
  title: "ClearSign | Local transaction review",
  description,
  applicationName: "ClearSign",
  openGraph: {
    title: "ClearSign",
    description,
    type: "website",
    siteName: "ClearSign",
  },
  twitter: { card: "summary_large_image", title: "ClearSign", description },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
