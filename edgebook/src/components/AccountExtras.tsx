"use client";

import { useState } from "react";
import { CheckCircle2, CloudUpload, Plug, XCircle } from "lucide-react";
import { Field } from "@/components/ui";
import { toast } from "@/components/Toaster";
import { setSync, updateSettings, useAppState, useHydrated } from "@/lib/store";
import { testConnection } from "@/lib/research/provider";
import { disconnectSync, syncNow } from "@/lib/sync";

function Status({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={`mt-2 flex items-start gap-1.5 text-[13px] ${ok ? "text-emerald-300" : "text-amber-200"}`} role="status">
      {ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden /> : <XCircle size={15} className="mt-0.5 shrink-0" aria-hidden />}
      {text}
    </p>
  );
}

/** Re-mounts once stored settings are loaded so the field shows the saved URL. */
export function DataSourceCard() {
  const hydrated = useHydrated();
  const state = useAppState();
  return <DataSourceForm key={hydrated ? `h:${state.settings.dataUrl ?? ""}` : "ssr"} />;
}

function DataSourceForm() {
  const state = useAppState();
  const [url, setUrl] = useState(state.settings.dataUrl ?? "");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const live = !!state.settings.dataUrl;

  const save = async () => {
    const clean = url.trim().replace(/\/+$/, "");
    if (clean && !/^https:\/\//.test(clean)) {
      setStatus({ ok: false, message: "Use the https:// address of your worker." });
      return;
    }
    setBusy(true);
    const r = clean ? await testConnection(clean) : { ok: true, message: "Using demo data." };
    setBusy(false);
    setStatus(r);
    if (r.ok) {
      updateSettings({ dataUrl: clean || undefined });
      toast(clean ? "Live data connected" : "Switched to demo data");
    }
  };

  return (
    <section className="mb-8" aria-labelledby="data-source-h" id="data-source">
      <h2 id="data-source-h" className="h-section mb-3">Match data</h2>
      <div className="card-pad">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Plug size={16} aria-hidden className={live ? "text-accent" : "text-muted"} />
          {live ? "Live data through your proxy" : "Demo data (sample matches and odds)"}
        </div>
        <Field label="Proxy URL" hint="Your Cloudflare Worker address, e.g. https://bonzstakes.yourname.workers.dev. Leave empty for demo data.">
          {(id, d) => (
            <input
              id={id}
              aria-describedby={d}
              className="input"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="https://…workers.dev"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </Field>
        <button className="btn-primary mt-3" onClick={save} disabled={busy}>
          {busy ? "Testing…" : url.trim() ? "Test & save" : "Use demo data"}
        </button>
        {status && <Status ok={status.ok} text={status.message} />}
      </div>
    </section>
  );
}

export function SyncCard() {
  const state = useAppState();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const connected = !!state.sync?.token;

  const run = async () => {
    setBusy(true);
    try {
      if (!connected) {
        if (!/^(github_pat_|ghp_)/.test(token.trim())) throw new Error("That doesn't look like a GitHub token.");
        setSync({ token: token.trim() });
      }
      setStatus({ ok: true, message: await syncNow() });
      setToken("");
    } catch (e) {
      if (!connected) setSync(null);
      setStatus({ ok: false, message: e instanceof Error ? e.message : "Sync failed." });
    }
    setBusy(false);
  };

  return (
    <section className="mb-8" aria-labelledby="sync-h">
      <h2 id="sync-h" className="h-section mb-3">Sync between devices</h2>
      <div className="card-pad">
        <p className="mb-3 text-sm text-muted">
          Keeps bets, notes and settings the same on your phone and PC, using a private Gist on your GitHub account.
          Your token stays on this device.
        </p>
        {connected ? (
          <>
            <p className="num text-[13px]">
              Connected{state.sync?.lastSync ? ` · last sync ${new Date(state.sync.lastSync).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={run} disabled={busy}>
                <CloudUpload size={16} aria-hidden /> {busy ? "Syncing…" : "Sync now"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  disconnectSync();
                  setStatus(null);
                  toast("Sync turned off on this device");
                }}
              >
                Turn off
              </button>
            </div>
          </>
        ) : (
          <>
            <Field
              label="GitHub token"
              hint="Fine-grained token with Account permissions → Gists: Read and write. Use the same token on each device."
            >
              {(id, d) => (
                <input
                  id={id}
                  aria-describedby={d}
                  className="input num"
                  type="password"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="github_pat_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              )}
            </Field>
            <button className="btn-primary mt-3" onClick={run} disabled={busy || !token.trim()}>
              {busy ? "Connecting…" : "Connect & sync"}
            </button>
          </>
        )}
        {status && <Status ok={status.ok} text={status.message} />}
      </div>
    </section>
  );
}
