import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="mx-auto mt-4 w-full max-w-5xl px-4 pb-28 pt-6 text-xs text-muted md:pb-10"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <p className="max-w-3xl leading-relaxed">
        BonzStakes is a research and journaling tool for adults (18+). It does not take bets or
        give betting advice, and probabilities are estimates, not predictions or guarantees. If
        betting is affecting your life, please talk to someone you trust or a licensed counsellor.
      </p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <Link href="/about" className="underline underline-offset-2 hover:text-foreground">
          How it works &amp; responsible use
        </Link>
        <span>Data stays on your device</span>
      </p>
    </footer>
  );
}
