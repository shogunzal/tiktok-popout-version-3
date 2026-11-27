# Forensic Analysis of `play-earn-funnel.zip` & Lineage Comparison

**Source Archive:** `/Users/zal/.gemini/antigravity/brain/69654e87-2d60-4aea-875d-73ac736c0c8d/.user_uploaded/media_1795734763258_1849c63a.zip`
**Extracted Directory:** `/Users/zal/.gemini/antigravity/brain/69654e87-2d60-4aea-875d-73ac736c0c8d/scratch/friend_zips/play-earn-funnel/`
**Extraction Audit:** 19 zip entries (3 directories, 16 regular files). Zero path traversal (`..` / absolute paths) and zero symlinks. No code from the archive was executed.

---

## 1. Complete File Tree, Timestamps & Architecture

### 1.1 Archive Manifest

| Path | Size (B) | Zip Timestamp | CRC32 | Role |
|---|---:|---|---|---|
| `play-earn/.gitignore` | 5 | `2026-11-26 17:45:34` | `118f1dfc` | Ignores `dist` |
| `play-earn/README.md` | 3,073 | `2026-11-26 17:50:20` | `01f131ac` | Kit overview, route table, CLI usage, compliance caveats |
| `play-earn/SETUP.md` | 3,299 | `2026-11-26 17:50:20` | `edcddaf6` | Deployment steps, ad URL template, customization & troubleshooting |
| `play-earn/build.py` | 6,752 | `2026-11-26 17:48:38` | `24c00911` | Python 3.10+ builder that templates `lander.html`/`worker.js`/`wrangler.toml` and embeds all assets into `dist/worker.js` |
| `play-earn/test.mjs` | 4,301 | `2026-11-26 17:50:20` | `9f16ac31` | Node 18+ local contract test importing `dist/worker.js` via `data:text/javascript;base64,...` |
| `play-earn/templates/worker.js` | 6,662 | `2026-11-26 17:45:34` | `c79f7b5a` | Cloudflare Worker router & runtime (`/w`, `/e`, `/z/h`, `/q`, `/eligibility`, `/visit`, `/assets/*`, telemetry stubs) |
| `play-earn/templates/escape.html` | 4,442 | `2026-11-26 17:45:34` | `1924b720` | Transition page served at `/e`: fake TikTok spinner, media/JSBridge keep-alives, feed return, 3-chunk sync XHR hold |
| `play-earn/templates/lander.html` | 43,270 | `2026-11-26 17:49:14` | `d50e6c25` | Dark-theme 3-step questionnaire SPA served at `/q` and `/questionnaire` |
| `play-earn/templates/wrangler.toml` | 97 | `2026-11-26 17:48:48` | `1a0e1577` | Cloudflare Wrangler config (`compatibility_date = "2026-11-01"`, `workers_dev = true`) |
| `play-earn/templates/assets/font.woff2` | 66,236 | `2026-11-26 17:45:34` | `a2105b81` | **TikTok Sans Light (Regular)** WOFF2 (SIL OFL 1.1; SHA-256 `f2c1c6f0488caf610bfbcbcfcd45f1bb65b54900b9d0bda66888aa2f9b7c3da4`) |
| `play-earn/templates/assets/calendar.png` | 51,795 | `2026-11-26 17:45:34` | `8ebea225` | 460×324 dark-mode illustration (pink-header calendar + star + gold `$` coins + gift box) |
| `play-earn/templates/assets/partner.svg` | 718 | `2026-11-26 17:48:48` | `77716a0d` | Sanitized placeholder icon (`"P"` inside cyan-to-pink `#25f4ee → #fe2c55` gradient ring on `#18181d`) |
| `play-earn/templates/assets/tiktok.svg` | 722 | `2026-11-26 17:45:34` | `68fc397a` | White TikTok musical-note SVG logo (`<title>TikTok</title>`) |
| `play-earn/templates/assets/cashapp.svg` | 970 | `2026-11-26 17:45:34` | `a9924bef` | White Cash App SVG logo |
| `play-earn/templates/assets/venmo.svg` | 1,504 | `2026-11-26 17:45:34` | `10d04ac4` | White Venmo SVG logo |
| `play-earn/templates/assets/apple.svg` | 675 | `2026-11-26 17:45:34` | `10730d40` | Dark `#111111` Apple logo SVG |

### 1.2 Architecture Overview
- **Type:** Standalone, self-contained **Cloudflare Worker kit** packaged as a sanitized template export (no Shopify storefront, no external CDN dependencies except optional Microsoft Clarity).
- **Build Pipeline (`build.py`):** Accepts `--worker-url`, `--offer-url`, `--program-name`, `--partner-name`, `--reward-text`, and optional `--clarity-id`. Base64-encodes `lander.html`, `escape.html`, and all 7 files in `templates/assets/` directly into a single deployable `dist/worker.js`, plus generates `dist/wrangler.toml`, `dist/config.json`, `dist/ad-url.txt`, and `dist/install.md`.
- **Ad Destination Template (`build.py` L137 / `SETUP.md` L62):**
  `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/w?sub1=__LAUNCH_SLUG__&s2=__LAUNCH_SLUG__&source=__LAUNCH_SLUG__&ttclid=__CLICKID__`
- **All Worker Routes (`templates/worker.js` L152–162):**
  - `GET /health` → `200 ok`
  - `GET /w` (or `/w/*`) → Stage 1 entry HTML (`snssdk1233://webview_popup` → `/e`)
  - `GET /e` (or `/e/*`) → Stage 2 transition page (`escape.html`)
  - `GET /z/h` → 3-chunk server-side sleep hold (`c=0`, `c=1` JSON; `c=2` HTML with second `snssdk1233://webview_popup` → `/q`)
  - `GET/POST /z/e`, `/z/c`, `/z/f`, `/visible`, `/diagnostic`, `/affiliate-hybrid-event` → `204 No Content` telemetry stubs
  - `GET /q` or `/questionnaire` → Stage 3 questionnaire SPA (`lander.html`)
  - `GET /assets/<name>` → Embedded static assets (`Cache-Control: public, max-age=86400`)
  - `POST /eligibility` → Unconditional approval stub (`{eligible: true}`)
  - `GET /visit` → Launch-slug validation (`[A-Za-z0-9_-]{1,64}`) and `302` to configured `OFFER_URL`

---

## 2. Entry, Cloaking, UA, Geo, Secret-Key & Bot-Filtering Analysis

Unlike `8sebgr-sx.myshopify.com` + `aww-funnel.3wingsandchips.workers.dev`, **`play-earn-funnel.zip` implements virtually NO server-side or client-side cloaking:**

- **No Shopify Safe-Page Wrapper:** Traffic hits `https://<worker>/w?...` directly (README explicitly states: *"No Shopify page is required."*).
- **No Server-Side UA Cloaking:** `worker.js` never inspects `request.headers.get("user-agent")`. Desktop Chrome, bots, and TikTok IAB all receive identical responses on `/w`, `/e`, `/z/h`, `/q`, and `/visit`.
- **Minimal Client-Side UA Check (`escape.html` L27, L33):** Only gates the `snssdk1233://feed` redirect inside `/e` using `/TikTok|musical_ly|Bytedance|trill/i.test(navigator.userAgent)`.
- **No Geo-Filtering:** Never reads `request.cf.country` or `Accept-Language`.
- **No Secret Key (`?k=`):** No authorization token check anywhere in `worker.js`.
- **No Fingerprinting or Behavioral Scoring:** No WebGL/JSBridge/AudioContext fingerprinter (`POST /fingerprint` is absent) and no dwell/scroll/touch-force decorator (`bh_*` params are absent).
- **Input Sanitization Only (`worker.js` L8–9, L17–19, L131–132):**
  - `SLUG = /^[A-Za-z0-9_-]{1,64}$/` enforces a valid `sub1` or `source` on `/visit` (missing/invalid returns `400 invalid launch`).
  - `TOKEN = /^[A-Za-z0-9_.~-]{1,1024}$/` sanitizes tracking query parameters (`sub1`, `s1`, `s2`, `source`, `ttclid`, `cid`).

---

## 3. Deep-Link Schemes, Spark Flags & Open-Redirect Chains

### 3.1 Hop 1 (`/w` → `/e` Transition Container)
`worker.js` lines 6, 47–54, 60–75 emit a `#000` black page with `<script>location.replace("snssdk1233://webview_popup?...")</script>`:
- **Scheme:** `snssdk1233://webview_popup` (uses `webview_popup` immediately on Stage 1, whereas `aww-funnel` / `gravy-clone` use `snssdk1233://webview` on Stage 1).
- **Open-Redirect Chain (Identical Double Hop):**
  1. `https://www.tiktok.com/link/v2?aid=1988&lang=en&scene=bio_url&target=<HOP_2>`
  2. `https://adclick.g.doubleclick.net/pcs/click?adurl=//<worker-host>/e?sub1=...&s2=...&source=...&ttclid=...` (protocol-relative `//host/path?query`)
- **Stage 1 Spark Flags (`ENTRY_FLAGS`, 7 flags):**
  - `use_spark=1`, `use_forest=1`, `enable_code_cache=1`, `trans_status_bar=1`, `disable_pop_gesture=1`, `disable_bounces=1`, `silent_load_type=1`
  - Notice `ENTRY_FLAGS` sets `disable_pop_gesture=1` and `silent_load_type=1` right on entry (and omits `hide_nav_bar`, `should_full_screen`, `container_bg_color`, etc. from Stage 1).

### 3.2 Hop 2 (`/e` Feed Return)
`escape.html` line 33:
- `location.replace('snssdk1233://feed')` (no `aweme://feed` or `aweme://__foryou` fallbacks).

### 3.3 Hop 3 (`/z/h?c=2` → `/q` Final Chromeless Popup)
`worker.js` lines 7, 86–96 emit an HTML snippet parsed by `escape.html` line 46–47:
- **Scheme:** `snssdk1233://webview_popup`
- **Open-Redirect Chain (Single DoubleClick Hop — skips `/link/v2`, identical to `aww-funnel` / `gravy-clone` Stage 2):**
  `https://adclick.g.doubleclick.net/pcs/click?adurl=//<worker-host>/q?s1=...&s2=...&source=...&sub1=...&ttclid=...&cid=...`
- **Stage 2 Spark Flags (`POPUP_FLAGS`, 12 flags):**
  - `use_spark=1`, `use_forest=1`, `enable_code_cache=1`, `trans_status_bar=1`, `disable_pop_gesture=1`, `disable_bounces=1`, `container_bg_color=00000000`, `loading_bg_color=00000000`, `hide_nav_bar=1`, `hide_more=1`, `should_full_screen=1`, `silent_load_type=1`
  - Notably **omits** 12 additional flags present in `aww-funnel`/`gravy-clone`: `hide_loading`, `show_loading`, `width=100%`, `height=100%`, `radius=0`, `enable_pull_down_close=1`, `disable_outside_click_close=0`, `isLinkFullScreen=1`, `landPageShowType=2`, `hide_status_bar=1`, `hide_title_bar=1`, `hide_bottom_nav_bar=1`. Also keeps `disable_pop_gesture=1` (blocking iOS edge-swipe dismissal) vs `0` in `aww-funnel`/`gravy-clone`.

---

## 4. Delay, Staging, Keep-Alive & Feed-Return Mechanism (Major Architectural Difference!)

`play-earn-funnel.zip` achieves the **exact same 17-second post-feed-return popup UX** (`p=17` hardcoded in `escape.html` L32 & L36, default `17` in `worker.js` L102), but uses a **completely different technical mechanism** from `aww-funnel` / `gravy-clone`:

1. **Immediate Feed Return BEFORE Holding (`escape.html` L33):**
   - Unlike `aww-funnel`/`gravy-clone` (which spawn the `webview_popup` first, poll `/flow-load-started`, and *then* fire `snssdk1233://feed`), `escape.html` fires `location.replace('snssdk1233://feed')` **immediately** before starting the delay loop.
2. **Five Parallel Background-Execution / Media-Focus Keep-Alives (`escape.html` L14–24):**
   Because the `/e` WebView must stay alive in the background for 17 seconds *after* TikTok switches back to the FYP, `escape.html` attempts to keep iOS/Android WebKit awake (while suppressing audio conflicts with the FYP video) using:
   - Looping silent base64 WAV `<audio id="__afocus">` (`volume` dropped from `0.1` → `0.001` after 100ms).
   - Looping muted 1×1 hidden base64 MP4 `<video id="__vfocus">`.
   - Web Audio API `AudioContext` 1 Hz oscillator at `gain = 0.0001`.
   - `navigator.mediaSession` with `playbackState = 'playing'`.
   - ByteDance JSBridge calls on `window.ToutiaoJSBridge`, `window.TikTokJSBridge`, and `window.BytedanceJSBridge` (`setBackgroundAudio`, `pauseBackgroundAudio`, `muteBackground`, `setVolume`, `setAudioFocus` with `{mute:true, volume:0, pause:true}`), plus injecting a hidden `<iframe src='bytedance://dispatch_message/?func=setBackgroundAudio&params={"mute":true}'>`.
3. **3-Chunk Synchronous XHR Hold Loop (`escape.html` L35–49 & `worker.js` L98–109):**
   - Inside `setTimeout(..., 0)`, `escape.html` executes **3 sequential synchronous `XMLHttpRequest` requests** (`x.open('GET', '/z/h?r=<rid>&p=17&tp=<track>&c=' + i, false); x.send();`) for `c = 0, 1, 2`.
   - On each request, `worker.js` sleeps `Math.round(total * 1000 / 3)` ms (`5,667 ms` per chunk for `p=17` → **`17.0s` total**; configurable 1–30s). Splitting the 17s hold across 3 requests avoids single-request HTTP timeouts while synchronous XHR blocks the JS event loop inside `/e`.
   - `c=0` and `c=1` return `{"cont": true, "next": 1|2}`.
   - `c=2` returns the `finalPopup()` HTML string containing `snssdk1233://webview_popup?...` pointing via DoubleClick to `/q`.
   - `escape.html` regex-extracts `snssdk1233://[^"'\s)\\]+` from `c=2`'s response text, unescapes `\u0026`/`\/`, and runs `location.replace(u)` from the backgrounded `/e` container to pop up `/q` over the FYP.
4. **Telemetry Hooks in `/e` (`escape.html` L26–48):**
   - Fires `/z/e?evt=p_exec|f_q|c0|c1|c2|cf<i>|fm|nm&t=<ms>`, `GET /z/c?cid=3012`, and `POST /z/f?cid=<rid>` with `{r: rid, p: 17, t: 17, s: true}` (where `rid` is a pseudo-UUID `00000000-0000-4000-a000-<hex-timestamp>`). All return `204` in this template.

---

## 5. UI / SPA, Dark Patterns, Fonts, Telemetry & Affiliate Params (`lander.html`)

- **Visual Theme & Assets:** Forced dark mode (`#111111` background, `#f5f5f7` text, `#fe2c55` pink, `#25f4ee` cyan), custom `TikTok Sans Light` WOFF2 font (`/assets/font.woff2`), TikTok musical-note logo inside a tilted smartphone hero graphic surrounded by floating Cash App, Venmo, Apple, and Partner cards + gold `$` coins + `"Earn {{REWARD_TEXT}}"`. Does **not** dynamically switch light/dark via TikTok UA tokens (`isDarkMode`/`AppTheme`).
- **3-Step Funnel & Dark Patterns:**
  1. **`#intro`:** `"You’ve been selected for our {{PROGRAM_NAME}}!"` / `"Verify eligibility, download our partner app, and start earning with your screen time."` / chips (`Play games`, `Complete offers`, `Cash & gift cards`) / CTA `"Show me how →"`.
  2. **`#eligibility`:** `"Eligibility check"` + `calendar.png` + `"How old are you?"` (`Month` / `Day` / `Year` 1900–2026 dropdowns). Submits `POST /eligibility` with `{dob: "YYYY-MM-DD"}`, which in `worker.js` L125 **unconditionally returns `{eligible: true}` for every DOB (including blank or underage dates)**—explicitly admitted in `README.md` L84.
  3. **`#steps`:** `"Make screen time pay."` / 3 numbered steps (Download `{{PARTNER_NAME}}` → Complete at least 2 deals → Earn `{{REWARD_TEXT}}`) + mandatory `#steps-affirmation` checkbox (`POST /eligibility` `{affirmed: true}`) unlocking `#go` (`"Download {{PARTNER_NAME}} →"`).
  4. **Disabled Close Button & Pinch-Zoom Lock:** Top nav renders `<button id="close" class="close-preview">×</button>` with an empty no-op click handler (`() => {}`) AND hides it via `<style id="owner-popup-standard-dismiss">.close-preview{display:none!important}</style>`. A capture-phase script blocks `gesturestart`/`gesturechange`/`gestureend` and multi-touch pinch zoom (`page-pinch-lock`).
- **Analytics, Diagnostics & Dead Pixel Remnant:**
  - Optional Microsoft Clarity loader (`https://www.clarity.ms/tag/{{CLARITY_ID}}`).
  - Diagnostic beacon script #1 (`lander.html` L30–58): `navigator.sendBeacon('/diagnostic', ...)` with `funnelDiagnosticId` tracking `questionnaire_seen`, `intro_next_clicked`, `intro_age_transition`, `intro_age_visible`, `age_screen_seen`, `age_submit`, `age_passed`, `age_rejected`, `ack_checked`, `offer_clicked`.
  - Diagnostic beacon script #2 (`lander.html` L60–77): `fetch('/affiliate-hybrid-event?fid=...&event=...')` tracking `questionnaire_script_started`, `questionnaire_initial_hidden`, `questionnaire_dom_ready`, `questionnaire_rendered`, `questionnaire_window_loaded`, `questionnaire_hidden/visible`, `questionnaire_pagehide`, `questionnaire_script_error`, `questionnaire_promise_error`.
  - Visibility beacon (`lander.html` L90 `<script data-questionnaire-visible>`): `POST /visible` after double `requestAnimationFrame` bounding-box visibility check.
  - **Dead Pixel Hook Remnant (`lander.html` L90):** On `#go` click, executes `window.__fx && window.__fx('CompleteRegistration')` and `window.__fx && window.__fx('Purchase')` with a `300ms` delay before `location.assign('/visit?...')`—even though `window.__fx` is never defined in `play-earn`! (In `gravy-clone`, `window.__fx` is defined by the TikTok Pixel snippet.)
- **Offer Redirect & MaxConv Parameter Schema (`worker.js` L129–146):**
  `GET /visit` redirects (`302`) to `OFFER_URL` with query params:
  - `utm_campaign=<slug>`, `utm_content=<ttclid || slug>`, **`mc_adset_name=<slug>`** (MaxConv tracker naming convention!), `source=<source || slug>`, `sub1=<slug>`, `s2=<s2 || slug>`, plus (when `ttclid` present) `ttclid`, `sub2`, and `sub5` all set to `ttclid`.

---

## 6. Direct Side-by-Side Comparison & Code Lineage Proof

### 6.1 Forensic Lineage Verdict
**`play-earn-funnel.zip` and `gravy-clone.3wingsandchips.workers.dev` (linked from `8sebgr-sx.myshopify.com/pages/go`) share the EXACT SAME questionnaire codebase (89.8% character-for-character identical), and share unmistakable kit lineage with `aww-funnel.3wingsandchips.workers.dev` (`/pages/goh`).**

**Irrefutable Code-Overlap Proofs:**
1. **89.8% Identical `lander.html` vs `gravy-clone/questionnaire`:**
   - `play-earn/templates/lander.html` (43,245 chars) vs `gravy_questionnaire__ios_tiktok_uk.html` (41,289 chars): `difflib.SequenceMatcher` ratio = **0.8818**; **37,065 characters** match in verbatim blocks ≥100 chars (**89.8%** of `gravy-clone`'s entire file).
   - Verbatim shared `<style>` IDs and full CSS blocks: `screentime-dark`, `program-refinements`, `program-continuity`, `reward-phone-hero`, `page-pinch-lock`, `owner-popup-standard-dismiss`.
   - Verbatim shared JS: pinch-zoom blocker (`page-pinch-blocked`/`page-pinch-check`), main panel/eligibility/affirmation state machine (`offerClickId` in `sessionStorage`, `sub5` propagation, `setTimeout(()=>location.assign(dest.href),300)`), and `<script data-questionnaire-visible>` double-rAF `POST /visible` beacon.
   - **Smoking-Gun Sanitization Artifact:** `gravy-clone`'s `/questionnaire` defines `w.__fx = function(event){ q.instance(id).track(event) }` inside its TikTok Pixel (`DC1EG8JC77UDGJANVGD0`) loader, and calls `window.__fx('CompleteRegistration')` / `window.__fx('Purchase')` on `#go` click. `play-earn` removed the TikTok Pixel snippet when sanitizing the export, **leaving behind the exact dead `window.__fx && window.__fx('CompleteRegistration')` and `window.__fx && window.__fx('Purchase')` calls** on line 90 of `lander.html`.
   - Similarly, `gravy-clone`'s `/questionnaire` uses `Screentime to Cash Program`, `Playful Rewards`, `$500/day`, and `/assets/playful.jpg` in the **exact positions** where `play-earn` has `{{PROGRAM_NAME}}`, `{{PARTNER_NAME}}`, `{{REWARD_TEXT}}`, and `/assets/partner.svg`.
2. **Shared Route, Scheme & Timing Lineage Across ALL THREE (`play-earn`, `gravy-clone`, `aww-funnel`):**
   - Exact shared telemetry endpoint name: **`/affiliate-hybrid-event`** (present in `play-earn/templates/worker.js` L160, `play-earn/templates/lander.html` L65, `gravy-clone` `/stage`, and `aww-funnel` `/pages/goh`, `/stage`, `/l/fc`).
   - Exact shared double open-redirect formula: `https://www.tiktok.com/link/v2?aid=1988&lang=en&scene=bio_url&target=` → `https://adclick.g.doubleclick.net/pcs/click?adurl=//<host>/...` (Stage 1) and direct `adclick.g.doubleclick.net/pcs/click?adurl=//<host>/...` (Stage 2).
   - Exact shared TikTok scheme & flags core: `snssdk1233://webview_popup`, `snssdk1233://feed`, `use_spark=1&use_forest=1&enable_code_cache=1&trans_status_bar=1&...&disable_bounces=1&container_bg_color=00000000&loading_bg_color=00000000&hide_nav_bar=1&hide_more=1&should_full_screen=1&silent_load_type=1`.
   - Exact shared hold duration target: **17 seconds** (`p=17` in `play-earn`, `17.11s` measured live on `aww-funnel`, `15.13s` on `gravy-clone`).
   - Exact shared TikTok UA regex: `/TikTok|musical_ly|Bytedance|trill/i` (`escape.html` L27 vs `aww_stage` L21 & `gravy_stage` L33 — character-for-character identical!).

### 6.2 Feature Comparison Matrix

| Dimension | `play-earn-funnel.zip` (Friend's Kit) | `gravy-clone` (`/pages/go` on `8sebgr-sx.myshopify.com`) | `aww-funnel` (`/pages/goh` on `8sebgr-sx.myshopify.com`, Live Ad) |
|---|---|---|---|
| **Entry Front Door** | Direct Worker URL (`/w?sub1=...&ttclid=...`); **no Shopify** | Shopify `/pages/go` → `POST /shopify-entry` | Shopify `/pages/goh` → `POST /shopify-entry` |
| **Cloaking / Safe Page** | **None** (no UA/geo/key gate, no safe page) | Client UA gate (`/blogs/news`) + `?k=demo` auto-inject | Dual client + server UA gate (`/blogs/news`) |
| **JSBridge Preservation** | Not needed (direct `/w` response, no Shopify wrapper) | `DOMParser` in-place mount (`preserveNativeContext: true`) | `DOMParser` in-place mount (`preserveNativeContext: true`) |
| **Stage 1 Scheme** | `snssdk1233://webview_popup` (7 flags, `disable_pop_gesture=1`, `silent_load_type=1`) | `snssdk1233://webview` (23 flags, `disable_pop_gesture=0`) | `snssdk1233://webview` (23 flags, `disable_pop_gesture=0`) |
| **Open-Redirect Chain** | Stage 1: `tiktok.com/link/v2` → DoubleClick; Stage 2: DoubleClick only | Stage 1: `tiktok.com/link/v2` → DoubleClick; Stage 2: DoubleClick only | Stage 1: `tiktok.com/link/v2` → DoubleClick; Stage 2: DoubleClick only |
| **Delay & Feed-Return Architecture** | **Client-driven:** `/e` runs 5 media/JSBridge keep-alives → fires `snssdk1233://feed` immediately → 3× sync XHR `/z/h?c=0..2` (~5.67s each = **17s**) → `/e` fires `snssdk1233://webview_popup` → `/q` | **Server-held popup:** `/stage` spawns `webview_popup` (`silent_load_type=1`) to `/delayed-questionnaire?m=hold` (**15.13s** single hold) → polls `/flow-load-started` (100ms / 1500ms) → fires `snssdk1233://feed` | **Server-held popup:** `/stage` spawns `webview_popup` (`silent_load_type=1`) to `/delayed-questionnaire` (**17.11s** single hold) → polls `/flow-load-started` (50ms / 850ms) → fires `snssdk1233://feed` |
| **Stage 2 Popup Flags** | 12 Spark flags (`disable_pop_gesture=1`) | 24 Spark flags (`disable_pop_gesture=0`, adds `landPageShowType=2`, `hide_title_bar=1`, `hide_bottom_nav_bar=1`, etc.) | 24 Spark flags (identical to `gravy-clone`) |
| **Questionnaire UI (`/q` vs `/l/fc`)** | Dark `#111` 3-step DOB + affirmation SPA (`{{PROGRAM_NAME}}`, `{{PARTNER_NAME}}`, `calendar.png`, `/assets/font.woff2` TikTok Sans Light) | **89.8% identical HTML/CSS/JS** to `play-earn/templates/lander.html` (`Screentime to Cash Program`, `Playful Rewards`, `$500/day`) | Redesigned light/dark-adaptive 356 KB single-file SPA (`TikTokSans` 4× base64 WOFF2, fake 18+ Yes/No, countdown timer, Freecash UK £20) |
| **Age Gate Behavior** | `POST /eligibility` always returns `{eligible: true}` | Client fetch mock checks `age >= 18` (`/__demo/eligibility`) | Fake 18+ gate (both Yes and No buttons call `show('s3')`) |
| **Analytics / Pixels** | Optional Clarity (`{{CLARITY_ID}}`); dead `window.__fx` Pixel calls left in `lander.html` | TikTok Pixel `DC1EG8JC77UDGJANVGD0` (`window.__fx` tracks `CompleteRegistration` + `Purchase`) | TikTok Pixel `DAHJ81BC77UEK70HT9N0` (`ttq.track('CompleteRegistration')`) |
| **Anti-Bot / Fingerprinting** | None | None in `/questionnaire` | 35-field JSBridge/WebGL/WebKit fingerprinter (`POST /fingerprint`) + `bh_*` behavioral decorator |
| **Offer Tracking Params** | `utm_campaign`, `utm_content`, **`mc_adset_name`**, `source`, `sub1`, `s2`, `ttclid`, `sub2`, `sub5` | Placeholder `https://REPLACE-OFFER-URL.example/go?sub1=...&sub5=...` | `/visit` → `linkthem.net` (`offer_id=5084`, `aff_id=201951`, `s3=<ttclid>`) → Glitchy → Freecash → Adjust |

### 6.3 Summary of Evolutionary Lineage
The evidence establishes a clear evolutionary progression within the same developer/kit ecosystem:
1. **`play-earn-funnel.zip`** is a **sanitized, standalone export** combining the **older client-held background-XHR transition engine** (`/w` → `/e` with audio/video/JSBridge keep-alives + immediate `snssdk1233://feed` + 3× synchronous `/z/h` chunks) with the **dark-theme DOB + affirmation questionnaire SPA** (`lander.html`).
2. **`gravy-clone.3wingsandchips.workers.dev`** (`/pages/go`) keeps **that exact same dark-theme DOB questionnaire SPA** (89.8% verbatim match, branded for *Playful Rewards / Screentime to Cash Program* with TikTok Pixel `DC1EG8JC77UDGJANVGD0`), but upgrades the entry and delay engine to **Shopify front-door + `DOMParser` JSBridge preservation + server-held `webview_popup` (`silent_load_type=1`) + `/flow-load-started` polling** (eliminating the fragile audio/video keep-alive + background sync-XHR hack).
3. **`aww-funnel.3wingsandchips.workers.dev`** (`/pages/goh`, the active ad captured in the user's screenshots) retains `gravy-clone`'s upgraded Shopify + server-held `silent_load_type=1` engine (tuned to 17.1s hold and 50ms/850ms polling), adds **server-side Worker UA cloaking**, swaps the questionnaire for a **newer TikTok-native-cloning light/dark SPA (`/l/fc`)** targeting **UK Freecash**, and layers on the **35-field fingerprinter** and **`bh_*` behavioral telemetry**.
