"use client";

import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import { ProbBar } from "@/components/charts";
import { pct } from "@/lib/format";
import { View } from "./views";

const QUALITY = {
  good: { tone: "green" as const, label: "Data: good", Icon: CheckCircle2 },
  limited: { tone: "amber" as const, label: "Data: limited", Icon: Info },
  poor: { tone: "red" as const, label: "Data: thin", Icon: TriangleAlert },
};

export default function ModelSummary({
  view,
  extra,
  takeaways,
}: {
  view: View;
  extra?: React.ReactNode;
  takeaways: string[];
}) {
  const { main } = view;
  const q = QUALITY[view.quality];
  const seg = (k: "home" | "draw" | "away", color: string) => {
    const label = main.labels[k];
    const value = main.probs[k];
    const r = main.ranges[k];
    if (label === undefined || value === undefined || !r) return null;
    return { label, value, color, sub: `${pct(r[0])}–${pct(r[1])}` };
  };
  const segments = [seg("home", "var(--home)"), seg("draw", "var(--draw)"), seg("away", "var(--away)")].filter(
    (s): s is NonNullable<typeof s> => s !== null
  );

  return (
    <div className="card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-base font-semibold">{view.title}</h2>
        <Badge tone={q.tone}>
          <q.Icon size={12} aria-hidden /> {q.label}
        </Badge>
      </div>
      <ProbBar segments={segments} big />
      <p className="hint mt-2 text-center">Small figures show the realistic range given your sample size.</p>
      {extra}
      <p className="mt-4 text-[13px] text-muted">{view.qualityNote}</p>
      <ul className="mt-4 space-y-2 border-t pt-4 text-sm" style={{ borderColor: "var(--border)" }}>
        {takeaways.map((t, i) => (
          <li key={i} className="flex gap-2.5">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
