export const pct = (p: number, d = 0) => `${(p * 100).toFixed(d)}%`;

export function money(n: number, currency = "BWP", signed = false) {
  const sign = signed && n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${currency} ${abs}`;
}

export const signedPct = (p: number, d = 1) =>
  `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p * 100).toFixed(d)}%`;

export function dateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const num = (s: string | number | undefined, fallback = NaN) => {
  if (s === undefined || s === "") return fallback;
  const n = typeof s === "number" ? s : Number(String(s).replace(",", "."));
  return isFinite(n) ? n : fallback;
};
