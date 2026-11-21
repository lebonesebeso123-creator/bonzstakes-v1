# BonzStakes data proxy

A tiny Cloudflare Worker that keeps your API keys secret and caches data so the free plans last.

## 1. Get the two free keys
- **football-data.org** → Register → the API token arrives by email (fixtures, results, half-time scores).
- **the-odds-api.com** → Get API key → Starter (free, 500 credits/month). Optional; without it prices are estimated.

## 2. Create the Worker (5 minutes, free)
1. Sign up at **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Create Worker** → name it `bonzstakes` → **Deploy**.
2. **Edit code** → replace everything with `worker.js` from this folder → **Deploy**.
3. **Settings → Variables and Secrets → Add**:
   - `FOOTBALL_DATA_KEY` (type **Secret**) → your football-data.org token
   - `ODDS_API_KEY` (type **Secret**) → your Odds API key
   - `ALLOWED_ORIGINS` (type **Text**) → `https://lebonesebeso123-creator.github.io,http://localhost:3000`
4. Optional but recommended: **Storage & Databases → KV → Create** a namespace `bonzstakes-cache`, then in the Worker
   **Settings → Bindings → Add → KV namespace**, variable name `CACHE`.
5. Copy the Worker URL (e.g. `https://bonzstakes.yourname.workers.dev`), open it with `/health` on the end: you
   should see `"footballData": true`.

## 3. Connect the app
BonzStakes → **Account → Match data** → paste the Worker URL → **Test & save**.

## Free-plan budget
- football-data.org: 10 requests/minute; each league's season is fetched at most every 30 minutes.
- The Odds API: each league refresh costs 2 credits (h2h + totals). Cached 12 hours → roughly 300–400 credits/month
  if you research daily. If you run out, the app keeps working with estimated prices.
