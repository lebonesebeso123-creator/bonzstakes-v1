"use client";

import { Surface, TennisInputs } from "@/lib/types";
import { Field, Segmented } from "@/components/ui";

const digits = (v: string) => v.replace(/\D/g, "");

export default function TennisForm({
  value,
  onChange,
}: {
  value: TennisInputs;
  onChange: (v: TennisInputs) => void;
}) {
  const set = <K extends keyof TennisInputs>(k: K, v: TennisInputs[K]) => onChange({ ...value, [k]: v });
  const an = value.a.trim() || "Player A";
  const bn = value.b.trim() || "Player B";

  const num = (k: keyof TennisInputs, label: string, ph?: string) => (
    <Field label={label} key={k}>
      {(id) => (
        <input
          id={id}
          className="input num"
          inputMode="numeric"
          placeholder={ph}
          value={value[k] as string}
          onChange={(e) => set(k, digits(e.target.value) as never)}
        />
      )}
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className="card-pad space-y-4">
        <h2 className="h-section">1 · The match</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Player A">
            {(id) => <input id={id} className="input" placeholder="e.g. Alcaraz" value={value.a} onChange={(e) => set("a", e.target.value)} />}
          </Field>
          <Field label="Player B">
            {(id) => <input id={id} className="input" placeholder="e.g. Sinner" value={value.b} onChange={(e) => set("b", e.target.value)} />}
          </Field>
        </div>
        <Field label="Tournament (optional)">
          {(id) => <input id={id} className="input" value={value.tournament} onChange={(e) => set("tournament", e.target.value)} />}
        </Field>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <span className="label">Surface</span>
            <Segmented<Surface>
              label="Surface"
              value={value.surface}
              onChange={(v) => set("surface", v)}
              options={[
                { value: "hard", label: "Hard" },
                { value: "clay", label: "Clay" },
                { value: "grass", label: "Grass" },
                { value: "indoor", label: "Indoor" },
              ]}
            />
          </div>
          <div>
            <span className="label">Format</span>
            <Segmented<3 | 5>
              label="Best of"
              value={value.bestOf}
              onChange={(v) => set("bestOf", v)}
              options={[
                { value: 3, label: "Best of 3" },
                { value: 5, label: "Best of 5" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="card-pad space-y-4">
        <h2 className="h-section">2 · Rankings &amp; form</h2>
        <div className="grid grid-cols-2 gap-3">
          {num("rankA", `${an}: ranking`, "e.g. 5")}
          {num("rankB", `${bn}: ranking`, "e.g. 42")}
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">
            Recent record on {value.surface} (last 10–20 matches)
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {num("winsA", `${an} wins`)}
            {num("lossesA", `${an} losses`)}
            {num("winsB", `${bn} wins`)}
            {num("lossesB", `${bn} losses`)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">Head-to-head (optional)</legend>
          <div className="grid grid-cols-2 gap-3">
            {num("h2hA", `${an} wins`)}
            {num("h2hB", `${bn} wins`)}
          </div>
        </fieldset>
        <p className="hint">
          Tennis is the roughest model here: it blends ranking, surface form and head-to-head with simple
          weights. Check fitness, fatigue and recent retirements yourself.
        </p>
      </div>
    </div>
  );
}
