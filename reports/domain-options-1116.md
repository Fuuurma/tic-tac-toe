# Domain options research — replace `tic-tac-toe-1ou.pages.dev` before the Furma social launch

**Slice:** TTT-DOMAIN-RESEARCH1 · **Date:** 2026-11-16 · **Status:** research only, no code changed, nothing purchased
**Repo:** `Fuuurma/tic-tac-toe` @ `5c544c7` (origin/main) · sibling: `~/Projects/gambit-deck` @ `c329dd0` (deploys to `gambit-deck.pages.dev`)
**Buying is Furma's call** — this report prices and ranks; it spends nothing.

---

## TL;DR

Every obvious game-name domain is taken or parked: all of `tictactoe.{com,gg,app,io,xyz,fun,games}`, `playtictactoe.com`, `gotictactoe.com`, `tictactoeplay.com`, `threeinrow.com`, `xo.io`, `ttt.io`, `ttt.gg`, `marks.gg`, `trio.*`, `tictoc.*`. What **is** available at standard registry price today:

1. **`fuurmagames.com`** (also `furmagames.com`, `fuurma.com`, `furma.com` is taken) — a `.com` brand umbrella at ~$10.46/yr at Cloudflare Registrar. Hosts tic-tac-toe now and gambit-deck later via subdomains. **Recommended.**
2. **`furma.games`** (alt spelling `fuurma.games` also free) — `.games` TLD, gamer-appropriate, same subdomain pattern; cheaper year one at Porkbun, pricier renewals.
3. **`threeinrow.io`** — the best *dedicated game* name still available if Furma wants the game on its own domain rather than a studio subdomain.

**Migration cost is near zero:** `fuurma-matchmaking` needs **no changes** (wildcard CORS `*`, no Origin check on the `/room/` WebSocket), and **no `VITE_*` or code change is required** — the only repo touch is `README.md`'s live-URL line. Exact steps below.

---

## 1. Candidates — live availability + prices (all lookups 2026-11-16)

Availability verified against each TLD's **authoritative registry RDAP** (Verisign `.com`, Identity Digital `.io`/`.games`, Google `.app`, CentralNic `.xyz`, Radix `.fun`); `.gg` has **no public RDAP** (IANA root DB), so `.gg` rows were checked via DNS + whois.com. Prices are per-TLD standard registration — actual checkout is final word; none of the *available* names below are dictionary/premium-tier.

**Registrar price table (USD/yr, register-first-year / renewal):**

| TLD | Cloudflare Registrar | Porkbun | Gandi |
|---|---|---|---|
| .com | $10.46→~$11.17 / same | $11.81 / $11.81 | $11.71 / $34.54–38.38 |
| .gg | **not supported** | $51.80 / $51.80 | $100.04 / $199.98 |
| .games | $26.20 / $26.20 | $8.24 / $30.38 | $36.43 / $71.37 |
| .app | $8.20 / $14.20 | $8.75 / $14.93 | $9.99 / $43.18+ |
| .io | $32.00 / $50.00 | $28.12 / $51.80 | $31.99 / $74.99 |
| .xyz | $12.30 / $11.20 | $1.29 / $14.21 | $1.99 / $35.98+ |
| .fun | $4.99 / $30.20 | $2.57 / $31.41 | $2.99 / $47.94 |

Sources: Cloudflare prices via costgoat.com's Cloudflare price list (theirs checked 2026-10-20, page last updated same day; Cloudflare publishes no public list — dashboard-only, registry+ICANN at-cost, reg=renew=transfer). **`.com` caveat:** Verisign's wholesale increase took effect 2026-11-01, so Cloudflare `.com` is ~$11.17/yr *now* — the $10.46 figure is the pre-increase snapshot; confirm at checkout. Porkbun `porkbun.com/tld/<tld>` pages; Gandi `gandi.net/en-US/domain/tld/<tld>` pages — both scraped live today. Namecheap/GoDaddy/domcomp could not be scraped (bot walls); two registrars satisfy the brief.

### Candidate table

| # | Domain | Status (2026-11-16) | Notes |
|---|---|---|---|
| 1 | `tictactoe.com` | **TAKEN** — premium/aftermarket | GoDaddy reg. 1996; Sedo/broker route only |
| 2 | `tictactoe.gg` | **TAKEN** — aftermarket | whois.com → Sedo offer; .gg has no Cloudflare Registrar anyway |
| 3 | `tictactoe.app` | **TAKEN** — parked | Dynadot reg. 2018, Afternic NS (for-sale) |
| 4 | `tictactoe.io` | **TAKEN** | Porkbun NS; **expires 2026-12-27** — watch for drop/renewal |
| 5 | `gotictactoe.com` | **TAKEN** | reg. 2025-08 — someone squatted it recently |
| 6 | **`fuurmagames.com`** | **AVAILABLE** | Verisign RDAP 404 ×2; brand+games `.com` |
| 7 | **`furmagames.com`** | **AVAILABLE** | Verisign RDAP 404 ×2 + who.is no-record + NXDOMAIN; shorter spelling |
| 8 | **`fuurma.com`** | **AVAILABLE** | Verisign RDAP 404 ×2; pure brand apex (`furma.com` taken by Spaceship) |
| 9 | **`furma.games`** | **AVAILABLE** | Identity Digital RDAP 404 ×2 |
| 10 | **`fuurma.games`** | **AVAILABLE** | Identity Digital RDAP 404 ×2; double-u spelling variant |
| 11 | **`threeinrow.io`** | **AVAILABLE** | Identity Digital RDAP 404 ×2; descriptive game name |
| 12 | **`threeinrow.games`** | **AVAILABLE** | Identity Digital RDAP 404 ×2 |
| 13 | **`threeinrow.app`** | **AVAILABLE** | Google Registry RDAP 404 |
| 14 | **`noughts.app`** | **AVAILABLE** | Google Registry RDAP 404; UK term, 7 chars |
| 15 | **`xo.xyz`** | **AVAILABLE** | CentralNic RDAP 404; X's-and-O's shorthand |
| + | `xo.fun`, `noughts.xyz`, `threeinrow.xyz`, `threeinrow.fun`, `noughts.fun`, `noughtsandcrosses.io/.games` | **AVAILABLE** | same-method verified; cut for table size |

Also checked and taken: `playtictactoe.com`, `tictactoeplay.com`, `threeinrow.com`, `tictactoegame.com`, `tictactoes.com`, `playttt.com`, `ttt.io`, `ttt.gg`, `ttt.games`, `ttt.xyz`, `ttt.fun`, `xo.io`, `xo.app`, `xo.games`, `marks.io/.app/.gg`, `trio.io/.app/.games/.xyz/.fun/.gg`, `tictoc.io/.app/.gg`, `noughts.io`, `tictactoe.fun/.xyz/.games`, `playtictactoe.app/.io`, `furma.com`.

**Premium flags:** the *taken* rows are the premium/aftermarket ones (Afternic/Atom/Sedo parking is the tell). None of the *available* rows show premium signals — but registrar checkout is the final arbiter; short `.io`/`.gg`-class names occasionally carry registry premium tiers.

---

## 2. Recommendations (ranked)

### 1. `fuurmagames.com` — buy at Cloudflare Registrar (~$11.17/yr post-Verisign-increase, renewal identical)

- The only `.com` that is both **brand-correct** (matches `Fuuurma` org / `fuurma-matchmaking`) and **game-scoped** — and it is unregistered at standard price, which is remarkable for a two-word brand `.com` in 2026.
- Covers the whole portfolio: tic-tac-toe at `fuurmagames.com` (or `ttt.`/`play.` subdomain) for the launch; gambit-deck later at `gambit.fuurmagames.com` — see §4.
- Cloudflare Registrar is the right store: at-cost pricing, renewal = registration price (no promo cliff), free WHOIS privacy, one-click DNSSEC, and the zone auto-activates on Cloudflare nameservers — exactly what Pages custom domains want. Buying at Porkbun/Gandi works too but adds a nameserver-change step.
- Defensive twin: also grab `furmagames.com` (~$10.46) — 4 chars shorter, typosquat/brand protection.

### 2. `furma.games` — buy at Cloudflare Registrar ($26.20/yr flat) or Porkbun ($8.24 yr-1 → $30.38 renew)

- `.games` is the on-the-nose TLD for a games launch and reads well in a social bio.
- Same subdomain umbrella as #1. Weaker than `.com` on trust/typing; renewal is the real cost — budget ~$26–30/yr, not the $8 teaser.
- Pick `fuurma.games` instead if Furma wants the double-u spelling consistent with the org.

### 3. `threeinrow.io` — dedicated game domain (Cloudflare $32→$50 renew, or Porkbun $28.12→$51.80)

- If the launch wants the *game itself* on a standalone memorable name rather than a studio subdomain, this is the best available: it's what tic-tac-toe is called generically, 10 chars, no hyphens.
- `.io` renewals are the priciest of the set (~$50/yr at CF) — fine for a launch-year experiment, annoying long-term.
- Weaker umbrella story: gambit-deck can't live under it.

**Honorable mentions:** `noughts.app` ($14.20 CF renew — cheapest sane renewal among available), `xo.xyz` ($11.20 CF renew — cheapest overall, but cryptic), `fuurma.com` (brand apex if the portfolio wants one canonical root).

---

## 3. Exact migration steps

### 3.1 Buy

1. dash.cloudflare.com → **Registrar → Register domain** (account already exists — same one owns Pages + the Worker).
2. Search `fuurmagames.com` → add → checkout (~$11). Optionally add `furmagames.com` in the same cart.
3. Cloudflare auto-creates the DNS zone on Cloudflare nameservers — no registrar-side NS change needed. (If bought at Porkbun/Gandi instead: add the site as a zone in the same CF account → Free plan → point the registrar's nameservers to the two Cloudflare assigns.)

### 3.2 Attach to the `tic-tac-toe` Pages project

Per [Cloudflare Pages custom-domain docs](https://developers.cloudflare.com/pages/configuration/custom-domains/) (checked 2026-11-16):

1. Dashboard → **Workers & Pages → `tic-tac-toe` → Custom domains → Set up a domain**.
2. Enter the domain. **Apex** (`fuurmagames.com`) requires the zone on the same CF account — satisfied by buying at CF Registrar or adding the zone manually. **Subdomain** (`ttt.fuurmagames.com`) also works via auto-CNAME, and technically works even with external DNS via a manual `CNAME → tic-tac-toe-1ou.pages.dev` — but apex is the recommendation.
3. Cloudflare issues the cert and flips the domain **Active** (minutes typical, up to 48 h).
4. Do **not** hand-create the DNS record first — a CNAME without the Pages-side association serves a `522` (docs' explicit warning).

### 3.3 Redirect `tic-tac-toe-1ou.pages.dev` → the new domain

`*.pages.dev` cannot be disabled, but the docs' own answer is an **account-level Bulk Redirect** ([custom-domains doc §"Disable access to *.pages.dev"](https://developers.cloudflare.com/pages/configuration/custom-domains/), [Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/)):

1. Dashboard → **Bulk Redirects** (account level — required, since `pages.dev` is not your zone) → New list.
2. Source: `tic-tac-toe-1ou.pages.dev` and `tic-tac-toe-1ou.pages.dev/*` → Target: `https://fuurmagames.com` (+ `/$1` path preservation, preserve query string) → **301**.
3. Deploy the list. Old shared links keep working and pass SEO equity to the new host.

### 3.4 What must change in `fuurma-matchmaking` — **nothing**

Verified in `~/Projects/fuurma-matchmaking` @ working tree, 2026-11-16:

- CORS is a wildcard: `Access-Control-Allow-Origin: *` (`src/utils.ts:117`) — there is **no origin allowlist** to update.
- The WebSocket route `GET /room/{roomId}` (`src/index.ts:692`) forwards to `GameRoomDO` after only an `Upgrade: websocket` check (`src/room.ts:234`) — **no Origin validation** on the socket either.
- No config, secret, or binding references the Pages hostname.

### 3.5 What must change in tic-tac-toe `VITE_*` / config — **nothing functional**

- `VITE_MATCHMAKING_URL` points at the Worker (`fuurma-matchmaking.sergiformatjer1999.workers.dev`), not at the Pages host — `.env.production`, `.env.example`, `wrangler.jsonc` all stay as-is.
- CSP `connect-src 'self' https://fuurma-matchmaking… wss://…` (`public/_headers`): `'self'` resolves per serving origin — automatic on the new domain.
- Invite links are built from `window.location.origin` (`src/components/game/onlineGameSurface.tsx:137,959`) — they inherit the new domain with zero code change.
- The only hardcoded `pages.dev` string in the repo is `README.md:9` — update it when the domain lands. `docs/DEPLOYMENT.md` smoke step takes `E2E_BASE_URL` as a parameter already.
- Post-cutover verification: `E2E_BASE_URL=https://fuurmagames.com pnpm test:e2e` (needs the local Worker on `127.0.0.1:8787` per AGENTS.md).

---

## 4. Can one domain host gambit-deck too? — **Yes, cleanly**

- Cloudflare Pages supports **multiple custom domains per project**, and **different Pages projects can each attach their own hostname under the same zone**. With `fuurmagames.com` (or `furma.games`) on Cloudflare DNS:
  - tic-tac-toe → apex `fuurmagames.com` + `www.` (or `ttt.fuurmagames.com`)
  - gambit-deck → `gambit.fuurmagames.com` — just another "Set up a domain" entry on the gambit-deck Pages project; Cloudflare writes the DNS record.
- Backend is already multi-game: `fuurma-matchmaking` serves `/api/matchmaking/{game}/…` for both `tictactoe` and gambit-deck, and each app's `VITE_MATCHMAKING_URL` stays the Worker URL regardless of hostname.
- One caveat for gambit-deck specifically: it serves same-origin `/api/auth/*` routes on its Pages project — a subdomain keeps that same-origin property (auth is per-host, which is fine; it has no accounts to migrate).
- This is the decisive argument for the umbrella pick: one ~$11–26/yr domain covers the whole Furma catalogue, and each future game gets a subdomain for free.

---

## Sources (all fetched 2026-11-16 unless noted)

- Availability: authoritative registry RDAP — `rdap.verisign.com/com/v1/domain/*` (.com), `rdap.identitydigital.services/rdap/domain/*` (.io/.games), `pubapi.registry.google/rdap/domain/*` (.app), `rdap.centralnic.com/xyz/domain/*` (.xyz), `rdap.radix.host/rdap/domain/*` (.fun); `.gg` via IANA root DB (no RDAP exists) + whois.com + DNS. Cross-checks: who.is, dig.
- Cloudflare Registrar: `cloudflare.com/products/registrar/` (at-cost, no public price list — confirmed by Cloudflare community thread community.cloudflare.com/t/tld-registration-and-renewal-prices/535720), `cloudflare.com/tld-policies/` (supported-TLD list — **.gg absent**), `cloudflare.com/application-services/products/registrar/buy-{tld}-domains/` pages, costgoat.com/pricing/cloudflare-domains (**prices checked 2026-10-20**).
- Porkbun: `porkbun.com/tld/{com,gg,games,app,io,xyz,fun}` live pages.
- Gandi: `gandi.net/en-US/domain/tld/{com,gg,games,app,io,xyz,fun}` live pages.
- Cloudflare Pages custom domains + pages.dev redirect: developers.cloudflare.com/pages/configuration/custom-domains/ and /rules/url-forwarding/bulk-redirects/ (doc updated 2026-11-11).
- Code facts: this repo (`wrangler.jsonc` name `tic-tac-toe`, `public/_headers` CSP, `.env.production`, `src/lib/matchmaking.ts`, `src/components/game/onlineGameSurface.tsx`, `README.md`), `~/Projects/fuurma-matchmaking` (`src/utils.ts` corsHeaders, `src/index.ts` /room/ route, `src/room.ts` Upgrade check), `~/Projects/gambit-deck` README (`gambit-deck.pages.dev`).

## Caveats

- Prices are TLD-level snapshots; registrar checkout, promos, and ICANN/registry fee changes can move them — Verisign's .com wholesale rose 2026-11-01 (CF .com ≈ $10.46 → ~$11.17). Premium/aftermarket names cost broker prices, not table prices.
- `tictactoe.io` expires 2026-12-27 — if it drops unrenewed it becomes the single best dedicated-game `.io`; worth a re-check post-launch.
- Availability was verified twice per name where rate limits allowed; domains can still be grabbed between this report and purchase — re-run the registry RDAP check at checkout time.
