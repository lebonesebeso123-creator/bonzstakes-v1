"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, Receipt, Wallet } from "lucide-react";
import { useAppState } from "@/lib/store";
import { bankrollOf } from "@/lib/stats";
import { money } from "@/lib/format";

const links = [
  { href: "/", label: "Analyse", Icon: Activity },
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
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          borderColor: "var(--border)",
          background: "rgba(15,23,42,0.8)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="BonzStakes home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-mono text-sm font-bold text-on-accent">
              B
            </span>
            <span className="font-mono text-[15px] font-semibold tracking-tight">BonzStakes</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-white/10 text-foreground"
                    : "text-muted hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <Icon size={16} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>

          <Link
            href="/account"
            className="num flex min-h-9 items-center rounded-lg px-3 text-[13px] text-muted transition-colors hover:text-foreground"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            aria-label={`Paper bankroll ${money(balance, state.settings.currency)}`}
          >
            {money(balance, state.settings.currency)}
          </Link>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden"
        style={{
          borderColor: "var(--border)",
          background: "rgba(15,23,42,0.92)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {links.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  isActive(href) ? "text-accent" : "text-muted"
                }`}
              >
                <Icon size={20} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
