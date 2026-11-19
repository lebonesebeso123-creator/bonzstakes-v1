import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works & responsible use",
  description: "How BonzStakes' football, basketball and tennis models work, what they can't do, and how to use them responsibly.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-pad">
      <h2 className="mb-3 font-mono text-base font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export default function About() {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="mb-2">
        <h1 className="h-page">How BonzStakes works</h1>
        <p className="mt-1 text-sm text-muted">Plain-English notes on the models, their limits, and using the tool responsibly.</p>
      </div>

      <Section title="What this is">
        <p>
          BonzStakes is a <strong>research and journaling tool</strong>. You type in recent results and the
          bookmaker&apos;s odds; it estimates probabilities and shows where your view and the market disagree.
          It is not a tipster, it does not take bets, and it has no access to live fixtures or odds.
        </p>
      </Section>

      <Section title="Football model">
        <p>
          Each team&apos;s recent goals scored and conceded are compared with what a typical team would have
          scored in the same venue and against the same level of opposition. Newer matches count more
          (each match back is weighted 8% less). Because a handful of games is noisy, every team is blended
          with the league average, so a 5–0 win doesn&apos;t make a team look unstoppable.
        </p>
        <p>
          Those strengths produce expected goals for each side. A <strong>Poisson model with a
          Dixon–Coles low-score correction</strong> turns them into a grid of scoreline probabilities, from
          which 1X2, over/under, both-teams-to-score, double chance and exact scores are derived.
        </p>
      </Section>

      <Section title="Basketball & tennis">
        <p>
          <strong>Basketball</strong> projects each team&apos;s score from its scoring and defence (pulled toward
          the league average for small samples) plus home-court advantage, then uses a normal distribution of
          margins and totals to price the moneyline, spread and totals.
        </p>
        <p>
          <strong>Tennis</strong> is a simple heuristic that blends ranking gap, recent surface form and
          head-to-head. It&apos;s the roughest of the three, so lean on the scorecard in Bets → Performance to see
          if it earns its keep.
        </p>
      </Section>

      <Section title="Reading the numbers">
        <p>
          <strong>Range.</strong> With few results the estimate is shaky, so the app shows a realistic range
          around each probability. The wider it is, the less you should trust it.
        </p>
        <p>
          <strong>Market probability.</strong> Bookmaker odds include a margin. When you enter every outcome of
          a market, the margin is removed to show what the bookmaker really thinks.
        </p>
        <p>
          <strong>EV (expected value).</strong> Average profit per 1 staked <em>if the model were exactly
          right</em>. <strong>Value</strong> means it clears your minimum edge even at the cautious end of the
          range. <strong>Lean</strong> means it clears it on the central estimate only. <strong>Fair</strong>{" "}
          is roughly break-even. <strong>Pass</strong> means the price is worse than the model.
        </p>
        <p>
          <strong>Suggested stake.</strong> A fraction of the Kelly criterion, calculated from the cautious end
          of the range and capped at a percentage of your bankroll. Treat it as a ceiling, not a target.
        </p>
      </Section>

      <Section title="What the models can't see">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Line-ups, injuries, suspensions, rotation, fatigue and motivation, unless you adjust for them yourself.</li>
          <li>Opposition quality beyond the coarse top/mid/low setting.</li>
          <li>Anything the bookmaker knows and you don&apos;t. Bookmaker prices are usually sharp, and a big gap is more likely missing information than a bargain.</li>
        </ul>
        <p>
          Track <strong>closing-line value</strong> and the <strong>model scorecard</strong> over dozens of bets
          before believing you have an edge. A few results prove nothing.
        </p>
      </Section>

      <Section title="Responsible use">
        <p>
          You must be <strong>18 or older</strong>. Only ever stake money you can afford to lose, set limits
          before you start, and never chase losses. Betting should be entertainment, not income.
        </p>
        <p>
          If betting is causing you stress, debt or problems with relationships or work, please talk to
          someone you trust or a licensed counsellor, and use the self-exclusion and limit tools that licensed
          operators provide.
        </p>
        <p>
          Gambling laws differ by country. You are responsible for following the rules where you live.
          BonzStakes is not affiliated with any bookmaker and contains no betting links.
        </p>
      </Section>

      <Section title="Privacy">
        <p>
          Everything you enter is saved <strong>only in your browser</strong>. There are no accounts, no
          tracking and no servers storing your data. That also means clearing site data erases it, so use
          Account → Download backup.
        </p>
      </Section>
    </div>
  );
}
