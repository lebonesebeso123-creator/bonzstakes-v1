/**
 * Private sync between your devices through a secret GitHub Gist.
 * Uses a GitHub token with Gists read & write. The token stays on this device and is never uploaded.
 */
import { AppState } from "./types";
import { getState, mergeStates, replaceState, setSync, shareable } from "./store";

const FILE = "bonzstakes-sync.json";
const API = "https://api.github.com";

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new Error("Can't reach GitHub. Check your connection.");
  }
  if (r.status === 401) throw new Error("GitHub rejected the token. Check it hasn't expired.");
  if (r.status === 403 || r.status === 404) throw new Error("The token can't use Gists. Give it Gists: read and write.");
  if (!r.ok) throw new Error(`GitHub error ${r.status}.`);
  return r.json() as Promise<T>;
}

interface Gist {
  id: string;
  files: Record<string, { filename: string; content?: string; truncated?: boolean; raw_url?: string }>;
}

async function findGist(token: string): Promise<string | null> {
  const list = await gh<Gist[]>(token, "/gists?per_page=100");
  return list.find((g) => g.files && FILE in g.files)?.id ?? null;
}

async function readGist(token: string, id: string): Promise<Partial<AppState> | null> {
  const g = await gh<Gist>(token, `/gists/${id}`);
  const f = g.files[FILE];
  if (!f) return null;
  let text = f.content ?? "";
  if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url)).text();
  try {
    return text ? (JSON.parse(text) as Partial<AppState>) : null;
  } catch {
    return null;
  }
}

/** Pull, merge, push. Returns a short status line. */
export async function syncNow(): Promise<string> {
  const s = getState();
  const token = s.sync?.token;
  if (!token) throw new Error("Add a GitHub token first.");
  let id = s.sync?.gistId || (await findGist(token));
  let merged = s;
  if (id) {
    const remote = await readGist(token, id);
    if (remote) merged = mergeStates(s, remote);
  }
  const content = JSON.stringify(shareable(merged));
  if (id) {
    await gh(token, `/gists/${id}`, { method: "PATCH", body: JSON.stringify({ files: { [FILE]: { content } } }) });
  } else {
    const g = await gh<Gist>(token, "/gists", {
      method: "POST",
      body: JSON.stringify({ description: "BonzStakes sync (private)", public: false, files: { [FILE]: { content } } }),
    });
    id = g.id;
  }
  replaceState({ ...merged, sync: { ...s.sync, token, gistId: id, lastSync: new Date().toISOString() } });
  return `Synced ${merged.bets.length} bets and ${merged.notes.length} notes.`;
}

export const disconnectSync = () => setSync(null);
