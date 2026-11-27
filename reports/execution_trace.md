# End-to-End Static Reverse-Engineering & Execution Trace

**Target Entry URLs**
1. White / Fallback Page: `https://8sebgr-sx.myshopify.com/blogs/news`
2. Ad Entry Page: `https://8sebgr-sx.myshopify.com/pages/goh?ttclid=E_C_P_...&px=p2&utm_source=tiktok&utm_medium=cpc&utm_campaign=Lead+generation20261123125542&utm_content=7711354016529285127_Ad+name2026-11-23+02:05:19&s1=1882654792241361`
3. Legacy Sibling Page (discovered via `/pages.json`): `https://8sebgr-sx.myshopify.com/pages/go`

**Verdict (100% Proven from Live Captured Code & HTTP Traces)**
- **Not a PWA or Service Worker**: `/manifest.json` and `/sw.js` both return `404` on `8sebgr-sx.myshopify.com` and `aww-funnel.3wingsandchips.workers.dev`.
- **Actual Mechanism**: A **3-stage TikTok Spark deep-link chain** (`snssdk1233://webview` -> `snssdk1233://webview_popup?...&silent_load_type=1` -> `snssdk1233://feed`) backed by a Cloudflare Worker (`aww-funnel.3wingsandchips.workers.dev`) that **holds the popup's HTTP response open server-side for ~17 seconds** while booting the user back to the TikTok For You feed. Because `silent_load_type=1` keeps the `webview_popup` container invisible until the page finishes loading, the chromeless full-screen fake-TikTok Freecash SPA pops up over the user's feed ~17 seconds after the initial swipe.

---

## Step-by-Step Execution Flow (Proven Line-by-Line)

### Stage 0 — TikTok Photo/Carousel Ad Swipe -> Shopify Front Door
- User swipes the TikTok Photo Ad (`"Our last pics before he cheated on me... (swipe)"`).
- TikTok's In-App Browser (IAB) opens `https://8sebgr-sx.myshopify.com/pages/goh?...`.
- **Why Shopify?** `8sebgr-sx.myshopify.com` (Shopify Shop ID `103264747894`, Horizon theme, GBP/GB, 0 products in `/products.json`) provides high-trust domain reputation for TikTok Ads review and a benign store/blog white page (`/blogs/news`).
- **No server-side cloaking on Shopify**: `fetcher`'s 29-request Shopify matrix (`responses/body_*.html`) proves Shopify serves identical page markup to Desktop Chrome, iOS Safari, Android TikTok, and iOS TikTok (diffs are only per-request Shopify `reqid`/`eventMetadataId`). All cloaking is performed client-side + on the Cloudflare Worker.

### Stage 1 — `/pages/goh` Client-Side Loader & UA Cloaking (`shopify_page_goh.html`)
Source: `/pages.json` (`id: 715683627382`, created `2026-11-22T14:16:34Z`, updated `2026-11-23T07:04:05Z`) and `<main>` of `/pages/goh`.

1. **Immediate Full-Screen Black Mask** (lines 68–70):
   ```html
   <div id="aww-loader" style="position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;...">
     <p ...>Loading your invitation…</p>
   </div>
   ```
   Covers the Shopify Horizon theme chrome immediately.
2. **Telemetry Beacon**: Sends `shopify_page_visited` (and any JS `error` events) via `navigator.sendBeacon` to:
   `https://aww-funnel.3wingsandchips.workers.dev/affiliate-hybrid-event?event=<event>&cid=<ttclid>`
3. **Client-Side UA Cloak** (lines 105–109):
   ```js
   if (!/TikTok|musical_ly|musically|BytedanceWebview|trill|aweme/i.test(navigator.userAgent)) {
     beacon("blog_bounce");
     location.replace("/blogs/news");
     return;
   }
   ```
   Non-TikTok browsers, reviewers, and crawlers are immediately bounced to `https://8sebgr-sx.myshopify.com/blogs/news`.
4. **Worker Authorization Call** (lines 127–132):
   `POST https://aww-funnel.3wingsandchips.workers.dev/shopify-entry`
   - Body: `{"entryURL": location.href, "requestId": crypto.randomUUID()}`
   - CORS header returned by Worker: `Access-Control-Allow-Origin: https://8sebgr-sx.myshopify.com`
   - **Worker-side UA Cloak (proven in `workers/aww_entry_goh_full__*.json`)**:
     - Desktop Chrome & iOS Safari -> `{"authorized": false, "fallback": "https://8sebgr-sx.myshopify.com/blogs/news"}`
     - iOS & Android TikTok UAs -> `{"authorized": true, "preserveNativeContext": true, "productionFlow": "aww-v1", "entryHTML": "...", "nativeURL": "...", "stageURL": "...", "questionnaireURL": "...", "flowID": "<uuid>"}`
     - Note: `?k=` secret gate is soft-observed (`missing_k_client` beacon) and currently NOT enforced on `/shopify-entry` (both `goh_full` without `k` and `goh_clean` without `ttclid`/`px`/`k` return `authorized: true` for TikTok UAs).
5. **In-Place DOM Mount to Preserve TikTok JSBridge** (lines 146–167):
   - Verifies `data.entryHTML.includes("snssdk1233://webview")`.
   - Because `data.preserveNativeContext === true`, it parses `data.entryHTML` with `DOMParser`, removes `#aww-loader`, clones `<style>` into `<head>`, and injects `<script>` nodes into `document.body` **without calling `document.write()`**.
   - Developer comment in live page source explains why:
     > `preserveNativeContext (worker sets this) → in-place DOM mount so window.JS2NativeBridge / ToutiaoJSBridge / JSBridge.call survive. Required for snssdk1233://webview to fire.`

### Stage 2 — Blank Black Screen & Double Open-Redirect into Chromeless Spark WebView (`aww_entry_goh_full__ios_tiktok_uk.entryHTML.html`)
Mounted `entryHTML` sets `html,body{background:#000!important}` (causing the **blank black screen** the user sees) and runs:
```js
(function(){
  var fired = false;
  function run() {
    if (fired) return;
    fired = true;
    location.replace("snssdk1233://webview?url=...");
  }
  document.addEventListener('visibilitychange', function(){ if (document.hidden) run(); });
  window.addEventListener('pagehide', run);
  window.addEventListener('blur', run);
  document.addEventListener('touchstart', run, { passive: true });
  run();
})();
```
- **Why those 4 event listeners + immediate `run()`?** If TikTok blocks or defers custom-scheme navigation on load, tapping the blank screen (`touchstart`) or leaving/swiping back (`visibilitychange` hidden, `pagehide`, `blur`) guarantees `snssdk1233://webview` still fires!
- **Double Open-Redirect Allowlist Bypass** (`decoded_native_url_chain.json`, both 302 hops verified live in `fetcher/stage2/`):
  1. `snssdk1233://webview?url=` -> `https://www.tiktok.com/link/v2?aid=1988&lang=en&scene=bio_url&target=...` (**HTTP 302** — TikTok's own trusted link wrapper bypasses internal `snssdk1233://webview` domain checks)
  2. `target=` -> `https://adclick.g.doubleclick.net/pcs/click?adurl=%2F%2Faww-funnel.3wingsandchips.workers.dev%2Fstage%3Fref%3D...` (**HTTP 302** — Google DoubleClick's open redirector bypasses TikTok `link/v2` domain/interstitial filters, using a protocol-relative `//aww-funnel...` target!)
  3. Final Spark WebView destination: `https://aww-funnel.3wingsandchips.workers.dev/stage?ref=<flowID>&slot=0&s1=1882654792241361&ttclid=<ttclid>&px=p2&cid=<ttclid>`
- **Spark Container Flags** (all 23 flags decoded in `decoded_native_url_chain.json`):
  - `use_spark=1&use_forest=1&enable_code_cache=1` (TikTok Spark/Forest hybrid container)
  - `container_bg_color=00000000&loading_bg_color=00000000&hide_loading=1&show_loading=0` (transparent / zero spinner — explains why transition looks blank!)
  - `width=100%&height=100%&radius=0&should_full_screen=1&isLinkFullScreen=1&landPageShowType=2`
  - `hide_nav_bar=1&hide_more=1&hide_status_bar=1&hide_title_bar=1&hide_bottom_nav_bar=1&trans_status_bar=1` (strips ALL TikTok IAB chrome: no URL bar, no X button, no `...` menu)

### Stage 3 — `/stage`: Silent Background `webview_popup` + Forced Return to TikTok FYP (`aww_stage__ios_tiktok_uk.html`)
This is the core mechanism that explains the **blank screen -> return to feed -> delayed full-screen popup**:
1. `/stage` renders another blank black document (`background:#000!important`, `<meta name="referrer" content="no-referrer">`).
2. It constructs a **second** deep link — this time **`snssdk1233://webview_popup`** with **`silent_load_type=1`**:
   ```js
   var delayedTarget = '//' + location.host + '/delayed-questionnaire?' + flowQuery;
   var popupTarget = 'https://adclick.g.doubleclick.net/pcs/click?adurl=' + encodeURIComponent(delayedTarget);
   var popup = 'snssdk1233://webview_popup?url=' + encodeURIComponent(popupTarget)
     + '&use_spark=1&use_forest=1&...&hide_nav_bar=1&hide_more=1&should_full_screen=1'
     + '&isLinkFullScreen=1&landPageShowType=2&hide_status_bar=1&hide_title_bar=1&hide_bottom_nav_bar=1'
     + '&silent_load_type=1';
   ```
   - `silent_load_type=1` instructs TikTok's Spark `webview_popup` controller to load the URL **silently in the background (hidden)** and only present/reveal the full-screen popup overlay once the page navigation completes!
3. Immediately after firing `location.replace(popup)` (with `touchstart` & `pagehide` fallbacks), `/stage` starts polling `GET /flow-load-started?ref=<flowID>` every **50ms** (up to 30 attempts) AND sets an **850ms hard timeout**:
   ```js
   function oldFeedReturn(reason) {
     if (returned) return;
     returned = true;
     trace(reason === 'accepted' ? 'feed_after_popup_started' : 'feed_without_popup_receipt');
     var inTT = /TikTok|musical_ly|Bytedance|trill/i.test(navigator.userAgent);
     if (inTT) { try { location.replace('snssdk1233://feed'); } catch(e) { trace('feed_error'); } }
   }
   setTimeout(poll, 0);
   setTimeout(function() { oldFeedReturn('timeout'); }, 850);
   ```
   - As soon as the silent `webview_popup` initiates its request to `/delayed-questionnaire`, the Cloudflare Worker flips `/flow-load-started?ref=<flowID>` from `{"started":false}` to `{"started":true}` (verified live in `stage3/aww_flow_started_before.json` -> `after.json`!).
   - `/stage` immediately navigates itself to **`snssdk1233://feed`**, returning the user straight back to the TikTok For You feed (within <=850ms — or if the user manually tapped/swiped back during the blank screen, `pagehide` still ensured `popup` fired).

### Stage 4 — `/delayed-questionnaire`: 17-Second Server-Side HTTP Hold (`stage3_summary.json`)
- While the user is back scrolling the TikTok FYP, the hidden `webview_popup` (`silent_load_type=1`) is waiting on `GET https://aww-funnel.3wingsandchips.workers.dev/delayed-questionnaire?ref=...`.
- Live timing measurements (`fetcher/stage3/stage3_summary.json`):
  - `aww-funnel.3wingsandchips.workers.dev/delayed-questionnaire` (iOS TikTok UA): **17.114 seconds** hold -> **HTTP 302** to `https://aww-funnel.3wingsandchips.workers.dev/l/fc?s1=1882654792241361&cid=...&px=p2&slot=0`
  - `aww-funnel.3wingsandchips.workers.dev/delayed-questionnaire` (Desktop Chrome UA): **17.312 seconds** hold -> **HTTP 302** to `/l/fc?px=p2&slot=0`
  - `gravy-clone.3wingsandchips.workers.dev/delayed-questionnaire` (iOS TikTok UA): **15.134 seconds** hold -> **HTTP 302** to `/questionnaire`
- Note: `gravy_stage__ios_tiktok_uk.html` reveals the delay mechanism name (`var delayMode = qs.get('m') || 'hold';`) and also lists backup deep-link variants (`snssdk1233://webview_popup`, `aweme://webview_popup`, `snssdk1233://webview`, `aweme://lynxview_popup`, and feed return fallbacks `snssdk1233://feed`, `aweme://feed`, `aweme://__foryou`).
- When the 17-second HTTP hold releases and `/l/fc` renders, TikTok's `silent_load_type=1` popup **suddenly pops up full-screen and chromeless right on top of the user's For You feed** — making it appear to be an official TikTok system modal! (Notice timestamps in user screenshots: 4:41 on ad -> 4:42 on popup.)

### Stage 5 — `/l/fc`: Self-Contained Fake-TikTok SPA ("Freecash rewards", 356 KB) (`aww_questionnaire_clean.html` & `aww_questionnaire_script_0..3.js`)
- **Zero external UI asset dependencies**: Embeds 4 Base64 `TikTokSans` / `TikTokSansDisplay` WOFF2 fonts (~167 KB) and 5 Base64 WebP illustrations/icons (~152 KB) directly inline so the popup paints in a single HTTP response with zero network latency.
- **Pixel-perfect TikTok native theme spoofing** (`aww_questionnaire_script_0.js` lines 3–49):
  - Mirrors TikTok's exact CSS variable naming (`--BGPrimary`, `--TextPrimary`, `--Primary: #fe2c55`, `--Cyan: #25f4ee`, etc.) and reads TikTok's internal UA theme tokens (`/isDarkMode\/(.{1})/` on iOS, `/AppTheme\/(\w+)/i` on Android) both server-side and client-side so light/dark mode matches the user's TikTok app.
- **3-Step SPA Flow & Dark Patterns** (`aww_questionnaire_script_0.js` lines 55–158):
  - **Screen `s1`**: TikTok note SVG, `"You've been selected"`, `"Turn Your Screen Time Into Cash"`, `"£20 bonus"`, `"Enrolment is closing soon"` with a **fake randomized 2–3 hour countdown timer** (`7200 + Math.random() * 3600` seconds persisted in `sessionStorage["enrol_deadline_v1"]` — matches `02:17:11` in screenshot), footer `"Free · 18+ only · Rewards paid by TikTok"`. Back chevron `<` is hidden on `s1` (`$('back').hidden = id === 's1'`).
  - **Screen `s2`** ("Are you 18 or older?"): **Fake age gate!** Both `"Yes, I'm 18 or older"` (`#btn-yes`) AND `"No, I'm under 18"` (`#btn-no`) call `show('s3')`! Screen `s2b` (`"Rewards aren't available under 18"`) is dead/unreachable HTML window-dressing.
  - **Screen `s3`** ("How it works" + `"Over £3.4 million in rewards paid out to users through our Screen Time to Cash Program."` + Freecash 4.6 rating card + `#download` `"Install Freecash"`).
  - **Context-menu suppression**: `dl.addEventListener('contextmenu', e => e.preventDefault())` blocks long-press link inspection.
- **TikTok Pixel & Conversion Tracking**:
  - Loads `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=DAHJ81BC77UEK70HT9N0&lib=ttq` (`px=p2` selects this pixel; `gravy-clone` uses `DC1EG8JC77UDGJANVGD0`).
  - Fires `ttq.page()` on load and `window.ttq.track('CompleteRegistration')` on clicking `"Install Freecash"`.
- **Per-Screen Funnel Beacons**: `/affiliate-hybrid-event?event=lander_viewed`, `lander_screen_s1`, `lander_screen_s2`, `lander_screen_s3`.
- **35-Field Device / WebView / Anti-Bot Fingerprinter** (`aww_questionnaire_script_2.js`):
  - Collects hardware (`hardwareConcurrency`, `deviceMemory`, `maxTouchPoints`, `AudioContext.maxChannelCount`, HEVC `hvc1` support), WebGL `UNMASKED_RENDERER_WEBGL`/`VENDOR`, screen/DPR/timezone/languages, pointer/hover media queries, engine tells (`eval.length`, `Error().stack`, `window.chrome`, `navigator.userAgentData`, `ApplePaySession`, `GestureEvent`, `navigator.standalone`, `navigator.webdriver`, `plugins.length`), and TikTok/iOS bridge presence (`ToutiaoJSBridge`, `JS2NativeBridge`, `JSBridge.call`, `JSBridgeMessageHandler`, `Object.keys(window.webkit.messageHandlers)`).
  - Sends JSON `{cid, fp}` via `sendBeacon('/fingerprint', ...)` at 100ms, `pagehide`, `beforeunload`, and `visibilitychange`.
- **Behavioral Telemetry Decorator** (`aww_questionnaire_script_3.js`):
  - Tracks dwell time (`bh_dwell`), max scroll % (`bh_scroll`), touch count (`bh_taps`), iOS touch force (`bh_force`), and pointerType (`bh_ptype`), appending them onto `<a href="/visit?...">` on `click`/`touchend`.

### Stage 6 — `/visit` -> Glitchy (`linkthem.net`) -> Freecash -> Adjust -> App Store / Play Store (`stage4_visit/visit_chains.json`)
Clicking `"Install Freecash"` navigates through 4 HTTP 302 hops:
1. `GET https://aww-funnel.3wingsandchips.workers.dev/visit?slot=0&sub2=<ttclid>&ttclid=<ttclid>&px=p2&bh_dwell=...`
   -> **302** to `https://linkthem.net/?offer_id=5084&aff_id=201951&s3=<ttclid>`
2. `GET https://linkthem.net/?offer_id=5084&aff_id=201951&s3=<ttclid>`
   -> **302** to `https://go.linkthem.net/aff_c?offer_id=5084&aff_id=201951&aff_click_id=gt_04_...` (Glitchy / Tune CPA affiliate tracker; passes `ttclid` in `s3` for S2S postback)
3. `GET https://go.linkthem.net/aff_c?...`
   -> **302** to `https://freecash.com?utm_source=glitchy&utm_medium=cpa&utm_campaign=FC_GLITCHY_RON_WW_TIER15_APP_REV1_21_08_2026&click_id=...&sub1=201951&sub2=&sub4=`
4. `GET https://freecash.com?...`
   - **iOS**: **302** to Adjust universal link `https://freecash.go.link/?adj_t=1tx4w2qo_1uyf6g9q&adj_campaign=FC_GLITCHY_RON_WW_TIER15_APP_REV1_21_08_2026&adj_adgroup=fc-app&adj_label=source%3Aglitchy%7Cclick_id%3A...%7Csub1%3A201951%7Csub2%3A%7Csub4%3Atiktok` -> HTML redirector (`visit_ios_tiktok_uk_hop4.html`) invoking `itms-apps://apps.apple.com/app/id1673567402?mt=8` (Apple App Store: Freecash, ID `1673567402`).
   - **Android**: **302** to `intent://?adj_t=1tx4w2qo_1uyf6g9q&...#Intent;scheme=freecash;package=com.freecash.app2;...;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.freecash.app2&referrer=adjust_reftag%3D...;end`.
   - **Desktop**: **302** to `https://freecash.com/en?...`.

---

## Passive OSINT & Infrastructure Findings
- **Cloudflare Workers Account**: `*.3wingsandchips.workers.dev`
  - Active production worker: `aww-funnel.3wingsandchips.workers.dev` (linked from `/pages/goh`)
  - Older prototype/template worker: `gravy-clone.3wingsandchips.workers.dev` (linked from `/pages/go`, contains placeholder `https://REPLACE-OFFER-URL.example/go`, older dark-theme "$500/day" DOB questionnaire, and `.scam` red badge CSS class left over from an earlier PoC/research clone!)
  - Additional sibling workers discovered passively via `urlscan.io` (`urlscan_3wingsandchips.json`):
    - `abisgay.3wingsandchips.workers.dev` (scanned `2026-11-19T21:08:54Z`, HTTP 200)
    - `relay-shou.3wingsandchips.workers.dev` (scanned `2026-11-13T21:22:28Z`, HTTP 404)
- **URL Parameter Mapping**:
  - `ttclid`: TikTok Ads Click ID (`E_C_P_...`), forwarded into `cid` and `sub2` on worker, then into `s3` on `linkthem.net` for S2S TikTok conversion attribution.
  - `px=p2`: Pixel selector (maps to TikTok Pixel `DAHJ81BC77UEK70HT9N0`).
  - `s1=1882654792241361`: TikTok campaign/adgroup sub-ID (16-digit TikTok Ads ID).
  - `utm_campaign=Lead generation20261123125542` & `utm_content=7711354016529285127_Ad name2026-11-23 02:05:19`: Confirms ad launched 2026-11-23 (same day `/pages/goh` was updated at `2026-11-23T07:04:05Z`).
- **Note on Minor Copy Delta vs User's Screenshot 2**:
  - Live `/l/fc` currently renders `"Turn Your Screen Time Into Cash"` on Screen 1, while Screenshot 2 showed `"Watch & Earn on TikTok / Your Screen Time to Cash Access Is Ready!"` — Screens 2 & 3 (`"Are you 18 or older?"`, `"How it works"`, `"Over £3.4 million in rewards paid out..."`, `"Install Freecash"`, `"Opens the App Store or Google Play."`, `"Enrolment is closing soon"`, `"£20 bonus"`, `"Rewards paid by TikTok"`) are an **exact word-for-word match** (the operator simply A/B-tested or tweaked the Screen 1 headline/slot copy between the user's capture and our live fetch).

---

## Saved Extracted Artifacts (`scratch/deobfuscator/`)
- `shopify_page_goh.html` & `shopify_page_go.html` — raw Shopify page payloads extracted from `/pages.json`
- `goh_full_ios_tiktok_main.html` — `<main>` of live `/pages/goh`
- `decoded_native_url_chain.json` — fully URL-decoded 4-layer `snssdk1233://webview` + open-redirect + 23 Spark flags
- `aww_questionnaire_clean.html` — readable `/l/fc` HTML with Base64 data URIs stripped
- `aww_questionnaire_script_0.js` — TikTok Pixel `DAHJ81BC77UEK70HT9N0`, UA theme spoofing, SPA router (with fake 18+ gate), fake countdown timer
- `aww_questionnaire_script_1.js` — `lander_viewed` beacon
- `aww_questionnaire_script_2.js` — 35-field WebView/JSBridge/hardware fingerprinter -> `POST /fingerprint`
- `aww_questionnaire_script_3.js` — behavioral telemetry (`bh_dwell`, `bh_scroll`, `bh_taps`, `bh_force`, `bh_ptype`) link decorator
- `gravy_questionnaire_script_0..4.js` — legacy `gravy-clone` SPA scripts (Pixel `DC1EG8JC77UDGJANVGD0`)
- `urlscan_3wingsandchips.json` — passive urlscan.io hits for `3wingsandchips.workers.dev`
- `iocs.json` — structured IOC list
