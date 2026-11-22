/**
 * Fast final scores from ESPN's public scoreboard (no key), so bets settle within hours instead of
 * waiting days for football-data.co.uk. Writes data/raw/espn.json:
 *   [{ div, t, home, away, status, fh, fa, hh, ha, corners }]
 * Run: node scripts/fetch-results.mjs [daysBack=5]
 */
import { mkdir, writeFile } from "node:fs/promises";

const SLUGS = { E0: "eng.1", E1: "eng.2", SP1: "esp.1", I1: "ita.1", D1: "ger.1", F1: "fra.1", N1: "ned.1", P1: "por.1", B1: "bel.1", SC0: "sco.1" };
const API = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const UA = { "User-Agent": "Mozilla/5.0 (BonzStakes results; personal use)", Accept: "application/json" };

async function json(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? undefined : Number(v));

const back = Number(process.argv[2] ?? 5);
const out = [];
const log = { fetchedAt: new Date().toISOString(), events: 0, completed: 0, withCorners: 0, withHT: 0, errors: [] };
for (const [div, slug] of Object.entries(SLUGS)) {
  for (let i = back; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const sb = await json(`${API}/${slug}/scoreboard?dates=${ymd(d)}`);
    if (!sb) {
      log.errors.push(`${div} ${ymd(d)}: no scoreboard`);
      continue;
    }
    for (const ev of sb.events ?? []) {
      log.events++;
      const comp = ev.competitions?.[0];
      const cs = comp?.competitors ?? [];
      const h = cs.find((c) => c.homeAway === "home");
      const a = cs.find((c) => c.homeAway === "away");
      if (!h || !a) continue;
      const type = ev.status?.type ?? comp?.status?.type ?? {};
      const name = String(type.name ?? "");
      const status = type.completed || type.state === "post" ? (/POSTPONED|CANCELED|CANCELLED|ABANDONED/.test(name) ? "VOID" : "FT") : /POSTPONED|CANCELED|CANCELLED/.test(name) ? "VOID" : "NS";
      const row = {
        div,
        t: ev.date,
        home: h.team?.displayName ?? h.team?.name,
        away: a.team?.displayName ?? a.team?.name,
        status,
        fh: num(h.score),
        fa: num(a.score),
      };
      if (status === "FT") {
        log.completed++;
        // half-time from the period scores, corners from the box score
        const hl = h.linescores?.[0]?.value ?? h.linescores?.[0]?.displayValue;
        const al = a.linescores?.[0]?.value ?? a.linescores?.[0]?.displayValue;
        let hh = num(hl), ha = num(al), corners;
        const sum = await json(`${API}/${slug}/summary?event=${ev.id}`);
        if (sum) {
          const teams = sum.boxscore?.teams ?? [];
          const c = teams.map((t) => num((t.statistics ?? []).find((s) => s.name === "wonCorners")?.displayValue));
          if (c.length === 2 && c.every((x) => x !== undefined)) corners = c[0] + c[1];
          if (hh === undefined || ha === undefined) {
            const hc = (sum.header?.competitions?.[0]?.competitors ?? []);
            const H = hc.find((x) => x.homeAway === "home"), A = hc.find((x) => x.homeAway === "away");
            hh = num(H?.linescores?.[0]?.displayValue ?? H?.linescores?.[0]?.value);
            ha = num(A?.linescores?.[0]?.displayValue ?? A?.linescores?.[0]?.value);
          }
        }
        if (hh !== undefined && ha !== undefined) {
          row.hh = hh;
          row.ha = ha;
          log.withHT++;
        }
        if (corners !== undefined) {
          row.corners = corners;
          log.withCorners++;
        }
      }
      if (row.home && row.away && row.t) out.push(row);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}
await mkdir("data/raw", { recursive: true });
await writeFile("data/raw/espn.json", JSON.stringify(out));
await writeFile("data/raw/espn-log.json", JSON.stringify(log, null, 1));
console.log(JSON.stringify(log));
