"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/10 text-slate-200",
    green: "bg-[rgba(94,224,160,0.16)] text-mint",
    amber: "bg-amber-400/20 text-amber-300",
    red: "bg-red-500/20 text-red-300",
    blue: "bg-[rgba(117,170,219,0.18)] text-sky",
    violet: "bg-purple-400/20 text-purple-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold capitalize ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const dId = hint || error ? `${id}-d` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children(id, dId)}
      {error ? (
        <p id={dId} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={dId} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex w-full rounded-lg p-1 sm:inline-flex sm:w-auto ${className}`}
      style={{ background: "rgba(2,6,23,0.45)", border: "1px solid var(--border)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-10 flex-1 rounded-md px-3.5 text-[13px] font-semibold transition-colors sm:min-h-9 sm:flex-none ${
              active ? "bg-accent text-on-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-5 flex gap-1 overflow-x-auto border-b"
      style={{ borderColor: "var(--border)" }}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="num ml-1.5 text-xs text-muted">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div
        className={`num mt-1 text-xl font-semibold ${
          tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-danger" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-muted" aria-hidden>
        {icon}
      </div>
      <h2 className="font-display text-[17px] font-bold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="sheet-backdrop fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
        className="sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] p-5 pt-3 outline-none sm:max-w-md sm:rounded-[24px] sm:pt-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
        <h2 id={id} className="font-display mb-4 text-xl font-bold tracking-[-0.01em]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Numeric input that keeps what the user typed ("2." stays "2.") while reporting parsed numbers. */
export function DecimalInput({
  id,
  value,
  onValue,
  describedBy,
  className = "",
}: {
  id?: string;
  value: number;
  onValue: (n: number) => void;
  describedBy?: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  return (
    <input
      id={id}
      aria-describedby={describedBy}
      className={`input num ${className}`}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(",", "."));
        if (e.target.value.trim() !== "" && isFinite(n)) {
          setSeen(n);
          onValue(n);
        }
      }}
    />
  );
}
