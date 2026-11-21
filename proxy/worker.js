/**
 * BonzStakes data proxy (Cloudflare Worker, free plan).
 *
 * Secrets / variables (Worker → Settings → Variables and Secrets):
 *   FOOTBALL_DATA_KEY  (secret)  token from football-data.org
 *   ODDS_API_KEY       (secret)  key from the-odds-api.com (optional: without it, prices are estimated)
 *   ALLOWED_ORIGINS    (text)    e.g. https://lebonesebeso123-creator.github.io,http://localhost:3000
 * Optional KV binding named CACHE (Worker → Settings → Bindings) to share the cache across devices.
 *
 * Routes:
 *   GET /health
 *   GET /fd/competitions/{CODE}/matches   → football-data.org v4, cached 30 min
 *   GET /odds/{sport_key}                 → The Odds API v4 h2h + totals (EU books), cached 12 h
 */
const FD = "https://api.football-data.org/v4";
const ODDS = "https://api.the-odds-api.com/v4/sports";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk && origin ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Expose-Headers": "X-Fetched-At",
      Vary: "Origin",
    };
    const reply = (body, status = 200, extra = {}) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...cors, ...extra },
      });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return reply({ error: "GET only" }, 405);
    // Browsers always send Origin on cross-site requests; block other sites from spending your quota.
    if (origin && !originOk) return reply({ error: "Origin not allowed" }, 403);

    if (url.pathname === "/health") {
      return reply({ ok: true, footballData: !!env.FOOTBALL_DATA_KEY, odds: !!env.ODDS_API_KEY, kv: !!env.CACHE });
    }

    let upstream, headers = {}, ttl;
    const fd = url.pathname.match(/^\/fd\/competitions\/([A-Z0-9]{2,4})\/matches$/);
    const odds = url.pathname.match(/^\/odds\/(soccer_[a-z_]+)$/);
    if (fd) {
      if (!env.FOOTBALL_DATA_KEY) return reply({ error: "FOOTBALL_DATA_KEY not set" }, 500);
      upstream = `${FD}/competitions/${fd[1]}/matches`;
      headers = { "X-Auth-Token": env.FOOTBALL_DATA_KEY };
      ttl = 30 * 60;
    } else if (odds) {
      if (!env.ODDS_API_KEY) return reply([], 200); // no key: no prices, the app estimates them
      upstream = `${ODDS}/${odds[1]}/odds?apiKey=${env.ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
      ttl = 12 * 60 * 60;
    } else {
      return reply({ error: "Not found" }, 404);
    }

    const key = `v1:${url.pathname}`;
    if (env.CACHE) {
      const hit = await env.CACHE.get(key, { type: "json" });
      if (hit && Date.now() - hit.at < ttl * 1000) return reply(hit.body, 200, { "X-Fetched-At": new Date(hit.at).toISOString() });
    }

    const res = await fetch(upstream, { headers });
    const text = await res.text();
    if (!res.ok) {
      // serve a stale copy rather than fail, if we have one
      if (env.CACHE) {
        const stale = await env.CACHE.get(key, { type: "json" });
        if (stale) return reply(stale.body, 200, { "X-Fetched-At": new Date(stale.at).toISOString(), "X-Stale": "1" });
      }
      return reply(text || { error: `Upstream ${res.status}` }, res.status);
    }
    if (env.CACHE) ctx.waitUntil(env.CACHE.put(key, JSON.stringify({ at: Date.now(), body: text }), { expirationTtl: 7 * 86400 }));
    return reply(text, 200, { "X-Fetched-At": new Date().toISOString() });
  },
};
