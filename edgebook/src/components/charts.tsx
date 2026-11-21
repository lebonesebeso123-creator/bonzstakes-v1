"use client";

import { pct } from "@/lib/format";

export interface Segment {
  label: string;
  value: number; // 0..1
  color: string; // css colour
  sub?: string; // small caption under the label, e.g. a range
}

export function ProbBar({ segments, big = false }: { segments: Segment[]; big?: boolean }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const summary = segments.map((s) => `${s.label} ${pct(s.value)}`).join(", ");
  return (
    <div>
      <div
        role="img"
        aria-label={summary}
        className={`flex w-full overflow-hidden rounded-full ${big ? "h-3.5" : "h-2.5"}`}
        style={{ background: "rgb(var(--tint) / 0.06)" }}
      >
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            className="h-full border-r border-[var(--ink)] last:border-r-0"
          />
        ))}
      </div>
      <div
        className="mt-2.5 grid gap-2 text-center"
        style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
      >
        {segments.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className={`num font-semibold ${big ? "text-2xl" : "text-lg"}`}>{pct(s.value)}</div>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted">
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="truncate">{s.label}</span>
            </div>
            {s.sub && <div className="num mt-0.5 text-[11px] text-muted">{s.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Model range (band) with the model estimate and the bookmaker's fair price marked. */
export function RangeBar({
  range,
  model,
  market,
}: {
  range: [number, number];
  model: number;
  market?: number | null;
}) {
  const left = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`;
  const label = `Model ${pct(model)}, range ${pct(range[0])} to ${pct(range[1])}${
    market != null ? `, market ${pct(market)}` : ""
  }`;
  return (
    <div role="img" aria-label={label} className="relative mt-2.5 h-5">
      <div
        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{ background: "rgb(var(--tint) / 0.08)" }}
      />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{
          left: left(range[0]),
          width: `${Math.max(1, (range[1] - range[0]) * 100)}%`,
          background: "color-mix(in oklab, var(--mint) 50%, transparent)",
        }}
      />
      <div
        className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-foreground"
        style={{ left: left(model) }}
      />
      {market != null && (
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[var(--ink)]"
          style={{ left: left(market), background: "var(--warn)" }}
        />
      )}
    </div>
  );
}

export function ScoreGrid({
  matrix,
  homeName,
  awayName,
  size = 6,
}: {
  matrix: number[][];
  homeName: string;
  awayName: string;
  size?: number;
}) {
  let max = 0;
  for (let h = 0; h < size; h++) for (let a = 0; a < size; a++) max = Math.max(max, matrix[h][a]);
  const idx = Array.from({ length: size }, (_, i) => i);
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[300px] border-separate border-spacing-1 text-center text-xs">
        <caption className="sr-only">
          Probability of each exact score. Rows are {homeName} goals, columns are {awayName} goals.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="p-1 text-[10px] font-medium text-muted">
              <span className="sr-only">Home goals down, away goals across</span>
              <span aria-hidden>H↓ A→</span>
            </th>
            {idx.map((a) => (
              <th key={a} scope="col" className="p-1 font-medium text-muted">
                {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {idx.map((h) => (
            <tr key={h}>
              <th scope="row" className="p-1 font-medium text-muted">
                {h}
              </th>
              {idx.map((a) => {
                const p = matrix[h][a];
                const strength = max ? p / max : 0;
                return (
                  <td
                    key={a}
                    className="rounded-md py-2"
                    style={{
                      background: `color-mix(in oklab, var(--mint) ${Math.round((0.06 + strength * 0.62) * 100)}%, transparent)`,
                      color: strength > 0.55 ? "var(--on-accent)" : "var(--foreground)",
                      fontWeight: strength > 0.55 ? 600 : 400,
                    }}
                  >
                    {p < 0.005 ? "<1" : (p * 100).toFixed(p < 0.1 ? 1 : 0)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint text-center">Chance (%) of each exact scoreline</p>
    </div>
  );
}

export function LineChart({
  data,
  format,
  height = 180,
}: {
  data: { label: string; value: number }[];
  format: (n: number) => string;
  height?: number;
}) {
  const W = 600;
  const H = height;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const vals = data.map((d) => d.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const first = data[0].value;
  const last = data[data.length - 1].value;
  const up = last >= first;
  const stroke = up ? "var(--mint)" : "var(--coral)";

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Bankroll over time. Started at ${format(first)}, now ${format(last)}, low ${format(Math.min(...vals))}, high ${format(Math.max(...vals))}.`}
      >
        <defs>
          <linearGradient id="bk-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad.l} x2={W - pad.r} y1={y(first)} y2={y(first)} stroke="var(--muted)" strokeOpacity="0.35" strokeDasharray="4 4" />
        <path d={area} fill="url(#bk-fill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(data.length - 1)} cy={y(last)} r="4.5" fill={stroke} />
        <text x={pad.l} y={H - 5} fill="var(--muted)" fontSize="11" fontFamily="var(--font-mono)">
          {data[0].label}
        </text>
        <text x={W - pad.r} y={H - 5} textAnchor="end" fill="var(--muted)" fontSize="11" fontFamily="var(--font-mono)">
          {data[data.length - 1].label}
        </text>
      </svg>
      <figcaption className="num mt-1 flex justify-between text-xs text-muted">
        <span>Low {format(Math.min(...vals))}</span>
        <span>High {format(Math.max(...vals))}</span>
      </figcaption>
    </figure>
  );
}
