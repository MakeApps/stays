import type { Metadata, Viewport } from "next";
import { Dancing_Script, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

/**
 * The three design-system families, self-hosted by Next rather than pulled from
 * Google's CDN at render time. Their CSS variables are re-bound onto
 * --font-sans / --font-mono / --font-script in styles/ds/app-additions.css.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

const dancing = Dancing_Script({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-dancing",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Baan.", template: "%s · Baan." },
  description: "Condo, booking and expense management for Bangkok rentals.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${dancing.variable}`}>
      <body>{children}</body>
    </html>
  );
}
