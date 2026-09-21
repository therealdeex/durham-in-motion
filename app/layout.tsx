import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Durham in Motion | How Durham Region Moves",
    template: "%s | Durham in Motion",
  },
  description:
    "Explore how people across Durham Region travel, how our communities differ, and how mobility has changed through decades of Transportation Tomorrow Survey data.",
  openGraph: {
    title: "Durham in Motion",
    description:
      "A portrait of how Durham Region moves on a typical weekday — and how that story has changed. Based on the Transportation Tomorrow Survey.",
    url: SITE_URL,
    siteName: "Durham in Motion",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "Durham in Motion" }],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Durham in Motion",
    description: "How Durham Region moves, told through the Transportation Tomorrow Survey.",
    images: ["/og-card.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <a href="#story" className="skip-link">
          Skip to the story
        </a>
        {children}
      </body>
    </html>
  );
}
