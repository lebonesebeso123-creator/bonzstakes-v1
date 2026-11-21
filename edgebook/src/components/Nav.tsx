"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Receipt, Search, Wallet } from "lucide-react";
import { useAppState } from "@/lib/store";
import { bankrollOf } from "@/lib/stats";
import { money } from "@/lib/format";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Research", Icon: Search },
  { href: "/bets", label: "Bets", Icon: Receipt },
  { href: "/journal", label: "Journal", Icon: BookOpen },
  { href: "/account", label: "Account", Icon: Wallet },
];

export default function Nav() {
  const pathname = usePathname();
  const state = useAppState();
  const { balance } = bankrollOf(state);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header
        className="glass-bar sticky top-0 z-40 border-b"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="BonzStakes home">
            <span className="logo-mark" aria-hidden>
              <svg viewBox="0 0 32 32" width="32" height="32">
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ffd978" />
                    <stop offset="1" stopColor="#f2c14e" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="9" fill="url(#lg)" />
                <path d="M10 8h7.2a4.4 4.4 0 0 1 1.9 8.4A4.8 4.8 0 0 1 17.6 25H10z" fill="#1d1503" />
                <path d="M13.4 11.2v3.6h3.4a1.8 1.8 0 0 0 0-3.6zm0 6.6v4h4a2 2 0 0 0 0-4z" fill="#f2c14e" />
              </svg>
            </span>
            <span className="font-display text-[17px] font-bold tracking-[-0.01em]">BonzStakes</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors ${
                  isActive(href)
                    ? "bg-tint/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-muted hover:bg-tint/5 hover:text-foreground"
                }`}
              >
                <Icon size={16} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/account"
            className="num flex min-h-9 items-center rounded-lg px-3 text-[13px] text-muted transition-colors hover:text-foreground"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            aria-label={`Paper bankroll ${money(balance, state.settings.currency)}`}
          >
            {money(balance, state.settings.currency)}
          </Link>
          </div>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {links.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                  isActive(href) ? "text-gold" : "text-muted"
                }`}
              >
                {isActive(href) && <span className="nav-glow" aria-hidden />}
                <Icon size={21} strokeWidth={isActive(href) ? 2.3 : 1.9} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
