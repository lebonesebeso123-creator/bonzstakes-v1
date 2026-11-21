import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/bricolage-grotesque/standard.css";
import "./globals.css";
import Nav from "@/components/Nav";
import Gate from "@/components/Gate";
import Footer from "@/components/Footer";
import Toaster from "@/components/Toaster";
import SlipBar from "@/components/research/SlipBar";
import SyncAgent from "@/components/SyncAgent";

export const metadata: Metadata = {
  title: {
    default: "BonzStakes · Match research",
    template: "%s · BonzStakes",
  },
  description:
    "Research every match in one tap: ranked picks across leagues and markets, value vs the odds, a slip builder and auto-settling paper bets. Private, free, no sign-up.",
  applicationName: "BonzStakes",
  keywords: ["bet research", "poisson model", "value betting", "paper trading", "match analysis"],
};

export const viewport: Viewport = {
  themeColor: "#0a1428",
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
        <SyncAgent />
        <Toaster />
      </body>
    </html>
  );
}
