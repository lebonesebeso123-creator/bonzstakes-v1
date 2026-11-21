import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works & responsible use",
  description: "How BonzStakes researches matches, where its estimates come from, what they can't do, and how to use them responsibly.",
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
          BonzStakes is a <strong>research tool</strong>. Pick a time frame and the markets you care about, and it
          scans every match, ranks the picks, and helps you build and track slips. It is not a tipster and it
          does not take bets.
        </p>
      </Section>

      <Section title="Where the estimates come from">
        <p>
          <strong>Form model.</strong> Each team&apos;s recent goals for and against are compared with what an
          average team would score at the same venue against the same level of opposition. Newer matches count
          more, and small samples are pulled toward the league average. A <strong>Poisson model with a
          Dixon–Coles correction</strong> turns the expected goals into scoreline odds, which give match result,
          double chance, BTTS, total goals, half-time markets and combos. Corners come from each side&apos;s
          recent corners won and conceded.
        </p>
        <p>
          <strong>Blended with the market.</strong> Bookmaker prices already contain a lot of information, so
          the chance you see is about 70% market and 30% form model. In testing this was more accurate than
          either one alone.
        </p>
        <p>
          <strong>Learning.</strong> When your slips settle, BonzStakes compares how often each market landed with
          how often it expected, and nudges future estimates by up to ±15%. It moves slowly on purpose.
        </p>
      </Section>

      <Section title="Reading the numbers">
        <p>
          <strong>Chance.</strong> The estimated probability that a pick wins. <strong>Most likely</strong> picks
          have the highest chance; they usually pay little.
        </p>
        <p>
          <strong>Value.</strong> The chance is higher than the odds imply, so the price is good in the long
          run. Value picks win less often than &quot;most likely&quot; ones.
        </p>
        <p>
          <strong>Chance all win.</strong> For a slip, every leg must land, so the chances multiply. Five picks
          at 80% each come in only about 33% of the time.
        </p>
      </Section>

      <Section title="What the models can't see">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Line-ups, injuries, suspensions, rotation, fatigue and motivation. Use the &quot;Dig deeper&quot; links on each match.</li>
          <li>Opposition quality beyond a coarse strong/average/weak rating.</li>
          <li>Anything the bookmaker knows and you don&apos;t. Bookmaker prices are usually sharp, and a big gap is more likely missing information than a bargain.</li>
        </ul>
        <p>
          Watch <strong>What the model learned</strong> and your ROI over dozens of slips before believing you
          have an edge. A few results prove nothing.
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
          BonzStakes is not affiliated with any bookmaker and contains no betting links. Until a live data source is connected, matches, odds and results are demo data.
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
