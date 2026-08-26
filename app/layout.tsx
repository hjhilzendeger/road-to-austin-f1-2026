import type { Metadata } from "next";
import { Archivo, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Archivo({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://road-to-austin-f1-2026.vercel.app"),
  title: "Road to Austin | F1 2026 Family Companion",
  description: "A fun, neutral guide to the 2026 Formula 1 season and the road to the United States Grand Prix in Austin.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Road to Austin",
    description: "F1 2026 family companion",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Road to Austin - F1 2026 Family Companion" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Road to Austin",
    description: "F1 2026 family companion",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={`${display.variable} ${body.variable}`}>{children}</body></html>;
}
