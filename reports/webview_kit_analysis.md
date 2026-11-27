# Forensic Analysis: `webview-kit-funnel.zip` vs Live `8sebgr-sx.myshopify.com` / `aww-funnel` / `gravy-clone`

**Archive Analyzed**: `/Users/zal/.gemini/antigravity/brain/69654e87-2d60-4aea-875d-73ac736c0c8d/.user_uploaded/media_1795734763258_39e77a5b.zip`
**Safe Extraction Path**: `/Users/zal/.gemini/antigravity/brain/69654e87-2d60-4aea-875d-73ac736c0c8d/scratch/friend_zips/webview-kit-funnel/`
**Safety Check**: Verified all 11 zip entries for path traversal (none found); zero code executed; static inspection only.

---

## Executive Verdict

**`webview-kit-funnel.zip` is undeniably from the EXACT same codebase lineage as `8sebgr-sx.myshopify.com` (`/pages/go` & `/pages/goh`) + `aww-funnel.3wingsandchips.workers.dev` + `gravy-clone.3wingsandchips.workers.dev`** — its own `templates/page-body.html` line 2 literally instructs:
> `Paste this as the BODY of a Shopify page (e.g. /pages/go or /pages/goh).`

It shares the identical `/shopify-entry` + `/stage` + `/affiliate-hybrid-event` route structure, identical TikTok UA regex, identical `DOMParser` in-place JSBridge-preserving mount algorithm, identical JSON response schema (`authorized`, `entryHTML`, `nativeURL`, `stageURL`, `flowID`, `preserveNativeContext`, `productionFlow`), and the same triple-wrap `snssdk1233://webview` -> `tiktok.com/link/v2` -> DoubleClick -> `/stage` pattern.

**HOWEVER, `webview-kit-funnel.zip` is a sanitized, stripped-down, single-stage immediate-WebView template that is MISSING the entire delayed-popup / chromeless-hijack engine we captured live on `aww-funnel` and `gravy-clone`:**
- **NO** `snssdk1233://webview_popup` and **NO** `silent_load_type=1`
- **NO** 23 chromeless Spark flags (`hide_nav_bar=1`, `should_full_screen=1`, `use_spark=1`, `container_bg_color=00000000`, etc.)
- **NO** `/delayed-questionnaire` (no 15–17s server-side HTTP hold) and **NO** `/flow-load-started` polling
- **NO** `snssdk1233://feed` / `aweme://feed` feed-return hijack
- **NO** TikTok UI impersonation (`TikTokSans` fonts, UA light/dark mirroring, fake 18+ gate, fake countdown, `"Rewards paid by TikTok"`)
- **NO** 35-field WebView/JSBridge/WebGL fingerprinter (`/fingerprint`) or behavioral telemetry link decorator (`bh_dwell`, `bh_scroll`, `bh_taps`, `bh_force`, `bh_ptype`)

In short: **`webview-kit-funnel.zip` alone will NOT reproduce the user's "blank -> go back -> delayed chromeless popup over FYP" UX** — it opens a standard TikTok in-app WebView immediately (~0.3s) directly to a generic dark-theme 2-step lander with a MaxConv (`mc_adset_name`) + Microsoft Clarity CTA.

---

## 1. Complete File Tree, Zip Metadata & Architecture

Archive metadata: Unix/macOS (`create_system=3`, zip version 30), empty archive/file comments, all entries stamped `2026-11-26 17:45:34` – `17:51:20`. Zero production domains, credentials, pixel IDs, offer URLs, or account names present (fully parameterized with placeholders).

```text
webview-kit/                        (dir,  2026-11-26 17:51:20)
├── .gitignore                      (19 B, 2026-11-26 17:45:34)  ignores dist/, __pycache__/
├── README.md                       (2543 B, 17:46:54)           overview, routes, CLI flags, disclaimers
├── SETUP.md                        (3429 B, 17:46:54)           deployment, verification, troubleshooting, rollback
├── setup.py                        (10154 B, 17:45:54)          Python 3.10+ interactive/CLI generator -> dist/
├── test.mjs                        (1933 B, 17:46:54)           Node 18+ local contract test importing dist/worker.js
└── templates/                      (dir,  17:45:34)
    ├── wrangler.toml               (97 B, 17:45:34)             Cloudflare Workers config (compatibility_date = "2026-11-01", workers_dev = true)
    ├── page-body.html              (5019 B, 17:45:34)           Shopify Page HTML/JS entry loader
    ├── worker.js                   (6780 B, 17:45:34)           Cloudflare Worker (ES module, 4 routes)
    └── lander.html                 (7807 B, 17:46:02)           2-step dark-mode lander (base64-embedded into worker.js by setup.py)
```

### Build & Runtime Architecture
1. `setup.py` validates inputs (`--worker-url`, `--offer-url`, `--store-url`, `--gate-key` [default `change-me-gate`], `--clarity-id`, `--pixel-id`, `--fallback-path` [default `/pages/notes`], `--flow-version` [default `my-flow-v1`], `--page-handle` [default `tt-webview-kit`], `--worker-name`, optional custom `--lander`), substitutes `"{{CLARITY_ID}}"` into `lander.html`, Base64-encodes `lander.html` into `LANDER_B64` inside `dist/worker.js`, and writes `dist/{worker.js, wrangler.toml, page-body.html, ad-url.txt, config.json, install.md}`.
2. Generated TikTok Ad Destination URL (`setup.py:170-176`):
   `{store_url}/pages/{page_handle}?k={gate_key}[&px={pixel_id}]&sub1=__LAUNCH_SLUG__&source=__LAUNCH_SLUG__&s2=__LAUNCH_SLUG__&ttclid=__CLICKID__&utm_source=tiktok&utm_id=__CAMPAIGN_ID__&utm_campaign=__CAMPAIGN_NAME__&utm_medium=paid`
3. Cloudflare Worker exposes 4 routes (`worker.js:156-166`):
   - `GET /health` -> `200 ok`
   - `POST/OPTIONS /shopify-entry` -> gate validation + returns JSON with `entryHTML`, `nativeURL`, `stageURL`, `flowID`, `preserveNativeContext: true`, `productionFlow`
   - `GET /stage` -> decodes `LANDER_B64`, builds attributed offer URL, returns `200 text/html` directly
   - `GET/POST /affiliate-hybrid-event` -> empty `204` no-op sink with CORS headers (comment suggests wiring to KV / Analytics Engine / D1)

---

## 2. Entry, Cloaking, UA, Gate-Key & Bot-Filtering Logic

### Client-Side (`templates/page-body.html`)
- **Visual Mask (lines 6–14)**: Covers viewport with black `#tt-loader` (`z-index:2147483647`, 3 bouncing white dots) AND hides all sibling body elements via `body>*:not(#tt-loader){opacity:0!important;pointer-events:none!important}`. Unlike live `/pages/goh`, `#tt-loader` is **never removed** upon mounting `entryHTML`.
- **Shopify Theme Editor Safe-Guard (line 40)**: `if (window.Shopify && window.Shopify.designMode) { beacon("skip_designmode"); return; }` (not in live `/pages/goh`).
- **UA Cloak (lines 23, 42–46)**:
  ```js
  var UA_TT = /TikTok|musical_ly|musically|BytedanceWebview|trill|aweme/i;
  if (!UA_TT.test(navigator.userAgent)) { beacon("non_tiktok_bounce"); location.replace(FALLBACK); return; }
  ```
- **Hard Client-Side Gate Key (lines 47–51)**:
  ```js
  if (incoming.searchParams.get("k") !== GATE) { beacon("wrong_gate"); location.replace(FALLBACK); return; }
  ```
- **CORS Preflight Avoidance (lines 86–92)**: Sends `POST /shopify-entry` with `headers: { "content-type": "text/plain" }` + `credentials: "omit"` + `cache: "no-store"` + `AbortSignal.timeout(12000)` and JSON body `{ entryUrl: incoming.href, requestId }`. Using `text/plain` avoids a browser CORS `OPTIONS` preflight round-trip. Retries up to 3x (`tries * 500ms`), then bounces to `FALLBACK`.
- **No Geo/IP/Referrer/Fingerprint Checks**: Purely UA + `?k=` + origin/path validation.

### Server-Side (`templates/worker.js:77-124`)
Enforces **5 sequential gates** (returning `{authorized: false, reason, fallback: CONFIG.fallbackPath}`):
1. **Crawler Blocklist (lines 18, 85–87)**: `/bot|crawler|spider|facebookexternalhit|slurp|bingpreview|curl|wget|python-requests/i` -> `reason: "crawler"`.
2. **TikTok UA Allowlist (lines 17, 88–90)**: `/TikTok|musical_ly|musically|BytedanceWebview|trill|aweme/i` -> `reason: "non_tiktok_ua"`.
3. **URL Parse + Exact Store Origin & Page Path (lines 91–97)**: Requires `incoming.origin === CONFIG.storeOrigin && incoming.pathname === CONFIG.pagePath` -> `reason: "bad_entry_url"` / `"wrong_entry_page"`.
4. **Hard Gate Key Match (lines 98–101)**: Requires `incoming.searchParams.get("k") === CONFIG.gateKey` -> `reason: "wrong_gate_key"`.
5. **Launch Slug Validation (lines 103–106)**: `sub1` must match `/^[A-Za-z0-9_-]{1,64}$/` if present -> `reason: "bad_launch_slug"`.
- **Single-Origin CORS (line 21)**: `Access-Control-Allow-Origin: CONFIG.storeOrigin`.
- **Note**: `worker.js:82` accepts both `body.entryUrl || body.entryURL` (supporting the `entryURL` key used by live `/pages/go` & `/pages/goh`).
- **Note on `/stage`**: `handleStage()` (`worker.js:126-142`) performs **NO UA check and NO gate-key check** (only validates `sub1` regex), mirroring how live `aww-funnel /stage` also returns `200` to Desktop Chrome.

---

## 3. Deep-Link Scheme, Spark Flags & Open-Redirect Chain

### `buildNativeURL(stageURL)` (`templates/worker.js:38-44`)
```js
function buildNativeURL(stageURL) {
  // Triple-wrap: snssdk1233://webview → tiktok.com/link/v2 → doubleclick → stage
  // This wrapping lets the webview destination pass TT's internal link review.
  const dclick = "https://ad.doubleclick.net/ddm/clk/pagead/aclk?adurl=" + encodeURIComponent(stageURL);
  const ttlink = "https://www.tiktok.com/link/v2?target=" + encodeURIComponent(dclick);
  return "snssdk1233://webview?url=" + encodeURIComponent(ttlink);
}
```
- **Scheme**: Only `snssdk1233://webview?url=...` (NO `webview_popup`, NO `aweme://`, NO `snssdk1233://feed`).
- **Spark Flags**: **NONE** (0 flags vs 23 chromeless Spark flags + `silent_load_type=1` on `aww-funnel`/`gravy-clone`).
- **Open-Redirect Differences**:
  - Uses `https://www.tiktok.com/link/v2?target=...` **without** `aid=1988&lang=en&scene=bio_url`.
  - Uses `https://ad.doubleclick.net/ddm/clk/pagead/aclk?adurl=<https://...>` instead of `https://adclick.g.doubleclick.net/pcs/click?adurl=//<host>/stage?...` (no protocol-relative `//` trick).

---

## 4. Staging, JSBridge Preservation & (Absence of) Delay Mechanism

### In-Place JSBridge Preservation (`templates/page-body.html:58-82`)
- Identical `DOMParser().parseFromString(html, "text/html")` in-place mount as `/pages/go` and `/pages/goh`:
  - Checks `!doc.body || !doc.body.querySelector("script")` and rejects any `<script src=...>` external scripts.
  - Appends `<style>` nodes to `document.head` and re-creates inline `<script>` elements on `document.body` so TikTok's native `JS2NativeBridge` / `ToutiaoJSBridge` / `JSBridge` context is preserved.
  - Falls back to `document.open(); document.write(data.entryHTML); document.close();` only if `mount()` fails after 3 retries (`page-body.html:110`).

### `buildEntryHTML(nativeURL, requestId)` (`templates/worker.js:46-55`)
```js
(function(){
  if (window.__ttEntryFired) return;
  window.__ttEntryFired = true;
  try { window.location.replace(nativeURL); } catch(e){}
  setTimeout(function(){ try { window.location.href = nativeURL; } catch(e){} }, 120);
})();
```
- Fires immediately + 120ms `location.href` fallback.
- Does **NOT** bind `visibilitychange` (hidden), `pagehide`, `blur`, or `touchstart` triggers (unlike `aww-funnel` / `gravy-clone`).
- **Zero Delay / Zero Feed Return**: `/stage` immediately serves `lander.html` (`200 OK`, `cache-control: no-store, no-cache, must-revalidate`, `x-flow-id: <flowId>`). There is no `/delayed-questionnaire`, no `m=hold`, no `/flow-load-started`, and no `snssdk1233://feed`.

---

## 5. Lander UI, Attribution, Pixels & Telemetry (`templates/lander.html`)

- **Presentation**: 7.8 KB self-contained dark-mode SPA (`#0f1115` background, `#ff2d55` pink CTA, `#00d4ff` cyan badge, system sans-serif fonts, `noindex,nofollow`, `viewport-fit=cover`, `safe-area-inset-*`).
- **Flow (2 Steps)**:
  - `step1`: Badge `"Limited Access"`, heading `"Your Reward Is Ready"`, `"Continue ->"` button (fires `ttq.track("InitiateCheckout")`).
  - `step2`: `"<- Back"`, `"3 Quick Steps"`, mandatory affirmation checkbox `#ackCheck` (`"I understand and am ready to continue."` — checking it unlocks `#ctaBtn` and fires `ttq.track("CompleteRegistration")`), and `#ctaBtn` `"Claim Now ->"` (clicking fires `ttq.track("Purchase")` and navigates directly to `BASE_CTA`).
  - Note: Unlike `aww-funnel`'s fake 18+ gate, `lander.html` genuinely blocks `#ctaBtn` click via `e.preventDefault()` until `#ackCheck` is checked — matching `gravy-clone`'s `#steps-affirmation` pattern!
- **Analytics / Pixels**:
  - Optional **Microsoft Clarity** (`https://www.clarity.ms/tag/{{CLARITY_ID}}`) — unique to `webview-kit`.
  - Optional **TikTok Pixel** (`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid={{PIXEL_ID}}&lib=ttq`) firing `page`, `InitiateCheckout`, `CompleteRegistration`, `Purchase`.
- **Direct CTA Attribution (`worker.js:59-71`)**:
  Appends to configured `CONFIG.offerUrl`:
  - `utm_campaign = launchSlug || flowId`
  - `utm_content = cid || launchSlug || flowId`
  - `mc_adset_name = launchSlug || flowId` (**MaxConv** tracker parameter!)
  - `source = launchSlug || flowId`
  - `sub1 = launchSlug || flowId`
  - `s2 = launchSlug` (when `launchSlug` present)
  - `ttclid = ttclid` (when present)
  - `sub5 = cid` (when present)
- **No Fingerprinting / No Behavioral Telemetry**: No `/fingerprint`, no WebGL/JSBridge probing, no `bh_dwell`/`bh_scroll`/`bh_taps`/`bh_force`/`bh_ptype`, no `contextmenu` blocking.
- **Minor Template Dead Code**: `worker.js:74` replaces `{{FLOW_ID}}` (not present in `lander.html`), `lander.html:106` declares unused `params`, `worker.js:69` redundantly sets `source` to `launchSlug` after line 64 already set `source` to `attribution`.

---

## 6. Side-by-Side Comparison Matrix

| Dimension | `webview-kit-funnel.zip` | `gravy-clone` (`/pages/go`) | `aww-funnel` (`/pages/goh`, Live Production) |
|---|---|---|---|
| **Shopify Page Reference** | Comment literally says `e.g. /pages/go or /pages/goh`; default handle `tt-webview-kit` | `/pages/go` (created `2026-11-22 11:31Z`) | `/pages/goh` (created `2026-11-22 14:16Z`, updated `11-23 07:04Z`) |
| **Worker Routes** | `/health`, `/shopify-entry`, `/stage`, `/affiliate-hybrid-event` | `/shopify-entry`, `/stage`, `/delayed-questionnaire`, `/flow-load-started`, `/questionnaire`, `/affiliate-hybrid-event`, `/stage-px` | `/shopify-entry`, `/stage`, `/delayed-questionnaire`, `/flow-load-started`, `/l/fc`, `/visit`, `/fingerprint`, `/affiliate-hybrid-event` |
| **TikTok UA Regex** | `/TikTok\|musical_ly\|musically\|BytedanceWebview\|trill\|aweme/i` | **Identical** | **Identical** |
| **Gate Key `?k=`** | Hard-enforced client + server (`wrong_gate_key`) | Auto-adds `k=demo` client-side | Soft beacon only (`missing_k_client`); worker allows without `k` |
| **Crawler UA Filter + Origin/Path Check** | Yes (`CRAWLER_UA`, `storeOrigin`, `pagePath`, `sub1` regex) | Minimal (desktop Chrome got `authorized:true` on `gravy-clone` `/shopify-entry`) | Server UA check (`authorized:false` for Desktop/Safari) |
| **POST Content-Type** | `text/plain` (skips CORS preflight) | `application/json` | `application/json` |
| **JSBridge Mount** | `DOMParser` in-place + `document.write` fallback (`preserveNativeContext: true`) | `DOMParser` in-place (`window.__gravyEntryMounted`, logs `window.__gravyBridgeBefore`) | `DOMParser` in-place (`preserveNativeContext \|\| gravyRecovery \|\| inPlaceMount`) |
| **Entry Deep-Link** | `snssdk1233://webview?url=...` (**0 Spark flags**) | `snssdk1233://webview?url=...` + **23 chromeless Spark flags** | `snssdk1233://webview?url=...` + **23 chromeless Spark flags** |
| **Open-Redirect Chain** | `tiktok.com/link/v2?target=` -> `ad.doubleclick.net/ddm/clk/pagead/aclk?adurl=https://...` | `tiktok.com/link/v2?aid=1988&lang=en&scene=bio_url&target=` -> `adclick.g.doubleclick.net/pcs/click?adurl=//...` | Same as `gravy-clone` |
| **Entry Trigger Events** | Immediate + `120ms` `location.href` | Immediate + `visibilitychange(hidden)` + `pagehide` + `blur` + `touchstart` | Same as `gravy-clone` |
| **Delayed Silent Popup + Feed Hijack** | **NONE** (`/stage` renders lander directly) | `snssdk1233://webview_popup` (+ `aweme://` / `lynxview_popup` backup variants) + `silent_load_type=1` + **15.13s** hold (`m=hold`) + `/flow-load-started` poll (100ms / 1500ms timeout) -> `snssdk1233://feed` | `snssdk1233://webview_popup` + `silent_load_type=1` + **17.11s** hold + `/flow-load-started` poll (50ms / 850ms timeout) -> `snssdk1233://feed` |
| **Lander UI & Brand Impersonation** | Generic dark 2-step `"Your Reward Is Ready"` (7.8 KB), checkbox affirmation, no TikTok branding | Dark 3-step `"Screentime to Cash Program"` / `$500/day` (41 KB), DOB check + affirmation checkbox, unused `.scam` badge CSS | Light/Dark UA-mirrored fake TikTok UI `"Freecash rewards"` (356 KB, 4 embedded `TikTokSans` WOFF2s, 5 WebPs), fake 2–3h timer, **fake 18+ gate** (Yes & No both -> `s3`), `"Rewards paid by TikTok"` |
| **Tracking / Telemetry** | Clarity + optional TikTok Pixel (`InitiateCheckout`, `CompleteRegistration`, `Purchase`) + empty `/affiliate-hybrid-event` | TikTok Pixel `DC1EG8JC77UDGJANVGD0` (`CompleteRegistration`, `Purchase`) + pinch-block + visibility beacon | TikTok Pixel `DAHJ81BC77UEK70HT9N0` (`CompleteRegistration`) + 35-field `/fingerprint` + `bh_*` behavioral decorator + per-screen beacons |
| **Offer Handoff** | Direct link to `CONFIG.offerUrl` with `mc_adset_name`, `sub1`, `sub5`, `s2`, `source`, `ttclid` | Placeholder `https://REPLACE-OFFER-URL.example/go` with `sub1`, `sub5` | `/visit` -> `linkthem.net` (`offer_id=5084`, `aff_id=201951`) -> Glitchy -> `freecash.com` -> Adjust -> App Store / Play Store |

### Lineage Conclusion
`webview-kit-funnel.zip` is clearly a **sanitized, repackaged derivative of the Shopify+Worker entry layer** from the same family as `gravy-clone` and `aww-funnel` (proven beyond doubt by the literal `/pages/go or /pages/goh` comment, `/affiliate-hybrid-event`, `preserveNativeContext`, `productionFlow`, `flowID`, `stageURL`, `nativeURL`, `entryHTML`, `entryUrl || entryURL`, identical UA regex, and identical `DOMParser` script-injection loop — plus `gravy-clone`'s dark checkbox-affirmation lander style and `sub1`/`sub5` + `CompleteRegistration`/`Purchase` pixel events). It adapts that front-door handoff for generic MaxConv (`mc_adset_name`) + Clarity campaigns while **omitting** all 23 chromeless Spark flags, the `webview_popup` + `silent_load_type=1` background loader, the 15–17s `/delayed-questionnaire` HTTP hold, the `snssdk1233://feed` return hijack, the TikTok UI impersonation, and the anti-bot fingerprinter.
