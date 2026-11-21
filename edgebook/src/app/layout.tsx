import type { Metadata, Viewport } from "next";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-sans/700.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import "@fontsource/fira-code/600.css";
import "./globals.css";
import Nav from "@/components/Nav";
import Gate from "@/components/Gate";
import Footer from "@/components/Footer";
import Toaster from "@/components/Toaster";
import SlipBar from "@/components/research/SlipBar";

export const metadata: Metadata = {
  title: {
    default: "BonzStakes · Match analysis & bet research journal",
    template: "%s · BonzStakes",
  },
  description:
    "Analyse football, basketball and tennis matches with transparent models, compare them with bookmaker odds, and track paper bets. Private, free, no sign-up.",
  applicationName: "BonzStakes",
  keywords: ["bet research", "poisson model", "value betting", "paper trading", "match analysis"],
};

export const viewport: Viewport = {
  themeColor: "#070b16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Gate />
        <Nav />
        <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-6">
          {children}
        </main>
        <Footer />
        <SlipBar />
        <Toaster />
      </body>
    </html>
  );
}
