import { DataProvider, DemoProvider, MatchHint, ResultOrVoid, demoForceResult } from "./data";
import { createLiveProvider } from "./live";
import { FileProvider } from "./file-provider";

const live = new Map<string, DataProvider>();

/**
 * Default: real data from football-data.co.uk, published with the site every 6 hours.
 * A proxy URL in Account switches to the (shelved) live APIs; "demo" uses the built-in sample data.
 */
export function getProvider(dataUrl?: string): DataProvider {
  const url = dataUrl?.trim();
  if (!url) return FileProvider;
  if (url === "demo") return DemoProvider;
  if (!live.has(url)) live.set(url, createLiveProvider(url));
  return live.get(url)!;
}

/** Results are fetched from whichever source a fixture came from. */
export async function resultFor(fixtureId: string, dataUrl?: string, forceDemo = false, hint?: MatchHint): Promise<ResultOrVoid | null> {
  if (fixtureId.startsWith("fdc:")) return FileProvider.getResult(fixtureId, new Date(), hint);
  if (fixtureId.startsWith("fd:")) return dataUrl ? getProvider(dataUrl).getResult(fixtureId) : null;
  return forceDemo ? demoForceResult(fixtureId) : DemoProvider.getResult(fixtureId);
}

export async function testConnection(dataUrl: string): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(`${dataUrl.replace(/\/+$/, "")}/health`);
    if (!r.ok) return { ok: false, message: `Proxy answered ${r.status}. Check the URL.` };
    const j = await r.json();
    if (!j.footballData) return { ok: false, message: "Proxy is up, but FOOTBALL_DATA_KEY isn't set." };
    return { ok: true, message: j.odds ? "Connected: fixtures, results and odds." : "Connected: fixtures and results. Add ODDS_API_KEY for prices." };
  } catch {
    return { ok: false, message: "Couldn't reach that URL." };
  }
}
