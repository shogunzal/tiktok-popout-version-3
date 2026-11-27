# TikTok Platform, In-App Browser (Spark/WKWebView), Deep-Link & Ad-Delivery Mechanics Analysis

**Scope:** Platform-level technical analysis explaining every step of the observed iOS TikTok UX flow (`8sebgr-sx.myshopify.com/pages/goh` → `aww-funnel.3wingsandchips.workers.dev` → Freecash App Store install), grounded directly in the live code captured by `fetcher` (#10), reverse-engineered by `deobfuscator` (#11), and visually inspected in the 4 user screenshots (#6).

---

## 1. Ad Format & Gesture Mechanics: Why Swiping Left Opens the Landing Page

- **Visual Forensic Evidence (Screenshot 1, 4:41 iOS):**
  - The feed unit displays handle `Laine`, TikTok's native `Photo` badge (`[stacked-cards] Photo`), the `Ad` disclosure tag, and the bottom CTA bar `Watch now >`.
  - Crucially, **there are no carousel pagination dots** above the handle, meaning the creative is a **single-image Photo Ad** (or a single-frame creative) with overlaid native-style white/black-stroke caption text: `"Our last pics before he cheated on me..."` and `"(swipe)"`.
- **TikTok Native Gesture Handler:**
  - In TikTok's For You Page (FYP) feed controller, **horizontal swipe-left** on organic single posts opens the creator's profile, whereas **horizontal swipe-left on an In-Feed Ad** (single video, single photo, or past the final frame of a multi-photo carousel) is bound natively to the ad's **destination URL**, sliding in TikTok's standard **Ad In-App Browser (IAB)** (`WKWebView` on iOS, `BytedanceWebview` / Chromium `WebView` on Android).
  - By adding `(swipe)` in TikTok's native font over a curiosity-gap relationship hook, the ad converts involuntary carousel-browsing muscle memory into high-intent ad clicks (opening `https://8sebgr-sx.myshopify.com/pages/goh?ttclid=...&px=p2&utm_source=tiktok&utm_medium=cpc&utm_campaign=Lead+generation20261123125542&...`).

---

## 2. Why Shopify (`*.myshopify.com`) Is Used as the Front Door

Captured in `scratch/fetcher/matrix_summary.json` and `extracted/shopify_page_goh.html`:

1. **Ad-Review Domain Trust & CDN Reputation:** `*.myshopify.com` domains inherit Shopify's global TLS/CDN reputation and are overwhelmingly associated with legitimate e-commerce storefronts, lowering initial automated friction during TikTok Ads Manager submission and post-approval sweeps.
2. **Same-Origin Safe-Page Fallback (`/blogs/news`):**
   - Shopify's server returns identical HTTP `200` responses regardless of User-Agent or query parameters.
   - Inside `/pages/goh`, a client-side check inspects `navigator.userAgent` against `/TikTok|musical_ly|musically|BytedanceWebview|trill|aweme/i`. Any non-TikTok visitor (desktop reviewers, headless desktop bots, Safari/Chrome inspections) is immediately redirected via `location.replace("/blogs/news")` to a benign, empty Shopify blog page on the exact same origin.
   - As a second defense-in-depth layer, `POST https://aww-funnel.3wingsandchips.workers.dev/shopify-entry` repeats the UA check server-side: non-TikTok UAs receive `{ "authorized": false, "fallback": "https://8sebgr-sx.myshopify.com/blogs/news" }`.
3. **Zero Custom Infrastructure Visible in Ad Manager:** The destination URL submitted in TikTok Ads Manager only exposes `8sebgr-sx.myshopify.com/pages/goh`—none of the `workers.dev`, `snssdk1233://`, or affiliate domains appear in the ad's static click URL.

---

## 3. Escaping TikTok's Standard Ad IAB: JSBridge Context Preservation & Deep-Link Architecture

### 3.1 Why In-Place DOM Mounting Matters (`preserveNativeContext: true`)
When TikTok loads an external ad URL in its standard iOS `WKWebView` / Android `WebView`, ByteDance injects native bridge globals (`window.JS2NativeBridge`, `window.ToutiaoJSBridge`, `window.JSBridge.call`) and/or hidden bridge `<iframe>` elements (`iframe[id*="JSBridge"]`).

As explicitly documented in the inline developer comments in `/pages/goh` and `/pages/go`:
- Calling `document.open(); document.write(entryHTML); document.close();` resets the document execution context and can wipe injected bridge references or detach bridge iframes inside TikTok's WebView.
- Setting `preserveNativeContext: true` causes `/pages/goh` to parse `entryHTML` via `new DOMParser().parseFromString(...)` and append its `<style>` and `<script>` nodes **in-place** into the live DOM so TikTok's native WebView bridge and scheme routing context remain intact when `location.replace("snssdk1233://webview?...")` executes.

### 3.2 How the Chromeless Full-Screen Container Is Achieved (Not a PWA, Not SFSafariViewController, Not Instant Page)

- **Ruled Out (Verified):**
  - **PWA / Service Worker:** `/manifest.json` and `/sw.js` return HTTP `404` on both `8sebgr-sx.myshopify.com` and `aww-funnel.3wingsandchips.workers.dev`; no `<link rel="manifest">` or `Service-Worker-Allowed` header exists.
  - **`SFSafariViewController`:** Always renders Apple's mandatory top URL bar (`Done`, domain lock, reload) and bottom toolbar; Screenshots 2–4 have zero Safari UI.
  - **TikTok Instant Page:** Native TikTok Ads Manager landing pages render inside TikTok's constrained template UI with native close/share chrome and cannot run arbitrary Cloudflare Worker API calls, custom 35-field fingerprinters, or dual `snssdk1233://` scheme transitions.

- **Actual Mechanism (Proven in Code):**
  The landing flow invokes **TikTok's internal ByteDance Spark hybrid container** via TikTok's registered custom URL schemes (`snssdk1233://webview` followed by `snssdk1233://webview_popup`; backup variants in `gravy-clone` also enumerate `aweme://webview_popup` and `aweme://lynxview_popup`).

### 3.3 Exact Spark Container Query Parameters Observed

| Parameter | Value | Platform / Rendering Effect Inside TikTok iOS/Android |
|---|---|---|
| `use_spark` | `1` | Routes into ByteDance's **Spark** hybrid WebView container (modern Lynx/WebView shell) rather than the legacy Ad IAB shell. |
| `use_forest` | `1` | Enables ByteDance's **Forest** resource loader inside Spark. |
| `enable_code_cache` | `1` | Enables JS bytecode caching in the WebView engine. |
| `hide_nav_bar` | `1` | **Strips the top navigation/URL bar** (no domain indicator, no native `X` close button). |
| `hide_title_bar` | `1` | Suppresses the page title header bar. |
| `hide_more` | `1` | **Hides the `...` overflow menu**, preventing users from inspecting the URL, reporting the page, or tapping "Open in Browser". |
| `hide_bottom_nav_bar` | `1` | Strips the bottom IAB back/forward/share toolbar. |
| `should_full_screen` | `1` | Expands the container to 100% viewport bounds. |
| `isLinkFullScreen` | `1` | Forces full-screen presentation for link-opened containers. |
| `landPageShowType` | `2` | Selects TikTok's full-screen landing-page presentation mode. |
| `trans_status_bar` | `1` | Makes the status bar background transparent so web content bleeds edge-to-edge under the iOS clock/signal icons (`4:42 ☾`). |
| `hide_status_bar` | `1` | Requests status-bar hiding (on iOS notch/Dynamic Island devices, `trans_status_bar=1` + safe-area handling keeps the dark system status bar overlaid on the white background, matching Screenshots 2–4). |
| `width` / `height` / `radius` | `100%` / `100%` / `0` | Forces edge-to-edge rectangular presentation with no modal sheet corner rounding. |
| `container_bg_color` / `loading_bg_color` | `00000000` | Fully transparent ARGB container and loading backgrounds so intermediate handoffs do not flash a visible sheet frame. |
| `hide_loading` / `show_loading` | `1` / `0` | Suppresses TikTok's native loading spinner during background staging. |
| `disable_bounces` | `1` | Disables iOS `UIScrollView` rubber-band overscroll so the page feels like a native Swift/UIKit screen instead of a webpage. |
| `disable_pop_gesture` | `0` | Leaves swipe-back pop gesture enabled (`0`) on the container. |
| `enable_pull_down_close` / `disable_outside_click_close` | `1` / `0` | Standard Spark popup sheet dismissal properties (effectively masked when rendered full-bleed 100%x100% with no drag handle). |
| **`silent_load_type`** | **`1`** | **The critical delayed-reveal flag on `snssdk1233://webview_popup`:** tells Spark to instantiate and load the popup WebView **silently/invisibly in the background** without presenting its view controller until the HTTP navigation resolves and loads the target page. |

### 3.4 Why the Double Open-Redirect Chain Is Required Inside `snssdk1233://webview`

TikTok's internal deep-link router applies host/trust checks to `snssdk1233://webview?url=...`: privileged chromeless parameters (`hide_nav_bar=1`, `should_full_screen=1`, etc.) or direct external navigation without warning interstitials are gated to trusted/first-party hosts. The lander chains **two verified live HTTP `302` redirects** to satisfy those checks:

1. **Hop 1 — TikTok First-Party Host (`www.tiktok.com`):**
   `https://www.tiktok.com/link/v2?aid=1988&lang=en&scene=bio_url&target=<HOP_2>`
   - Because the initial `url=` host is `www.tiktok.com`, TikTok's Spark router treats the target as a first-party TikTok URL and honors the chromeless Spark container flags.
   - `www.tiktok.com/link/v2` validates `target=` before issuing a direct `302` (instead of an external-link warning page).
2. **Hop 2 — Google DoubleClick Open Redirect (`adclick.g.doubleclick.net`):**
   `https://adclick.g.doubleclick.net/pcs/click?adurl=//aww-funnel.3wingsandchips.workers.dev/stage?...`
   - `adclick.g.doubleclick.net` is a high-reputation Google ad-serving domain accepted by `/link/v2` without triggering a warning interstitial.
   - Passing a protocol-relative URL (`//aww-funnel.3wingsandchips.workers.dev/...`) in `adurl=` causes DoubleClick to issue an immediate `302 Location: //aww-funnel...`, landing the chromeless Spark WebView directly on the attacker's Cloudflare Worker.
   - Notably, in Stage 2 (`snssdk1233://webview_popup?url=...`), the script skips `/link/v2` and passes `https://adclick.g.doubleclick.net/pcs/click?adurl=//.../delayed-questionnaire?...` directly to `webview_popup`.

---

## 4. Exact Root Cause of the "Blank Page → Return to Feed → Popup Seconds Later" Sequence

Before code capture, a common hypothesis for post-dismissal popups is a client-side `setTimeout` surviving inside a backgrounded `WKWebView`. **Live code and timing probes prove this system uses a much more deterministic, server-orchestrated architecture:**

### Step-by-Step Timeline (Explaining the 4:41 → 4:42 Screenshot Progression)

1. **T = 0.0s (4:41) — Swipe-Left Opens Blank/Black Ad IAB:**
   - Swiping left on the `Laine` Photo Ad opens `8sebgr-sx.myshopify.com/pages/goh?...`.
   - `/pages/goh` immediately covers the screen with a `#000` black full-viewport overlay (`#aww-loader`), posts to `/shopify-entry`, removes `#aww-loader`, and mounts `entryHTML` (`background:#000!important` — completely blank black screen).
   - `entryHTML` triggers `location.replace("snssdk1233://webview?...")` immediately (with backup listeners on `visibilitychange`, `pagehide`, `blur`, and `touchstart` in case the initial call is blocked or the user immediately starts dismissing the page).
2. **T ≈ 0.3s–0.8s — Invisible Staging Handoff (`/stage`):**
   - The chromeless Spark WebView (`container_bg_color=00000000`, `background:#000!important`) follows the double `302` (`tiktok.com/link/v2` → `adclick.g.doubleclick.net`) to `/stage?ref=<flowID>&...`.
   - To the user, this entire transition appears as a **blank/empty black screen** that failed to load.
   - `/stage` immediately executes two concurrent actions:
     1. Fires **`location.replace("snssdk1233://webview_popup?url=https%3A%2F%2Fadclick.g.doubleclick.net%2Fpcs%2Fclick%3Fadurl%3D...%2Fdelayed-questionnaire...&...&silent_load_type=1")`** (with `touchstart` and `pagehide` fallbacks). Because of `silent_load_type=1`, TikTok spawns the popup container **silently in the background** without showing anything on screen yet.
     2. Starts polling **`GET /flow-load-started?ref=<flowID>`** every `50ms` (up to 30 attempts, with an `850ms` fallback timer; `1500ms` in `gravy-clone`).
3. **T ≈ 0.5s–1.5s — Forced (or User-Initiated) Return to TikTok FYP (`snssdk1233://feed`):**
   - As soon as TikTok's background `webview_popup` hits `/delayed-questionnaire?ref=<flowID>`, the Cloudflare Worker flips server-side state for `<flowID>` from `{"started":false}` to `{"started":true}` (verified live in `stage3/aww_flow_started_before.json` and `after.json`)—**and intentionally holds the `/delayed-questionnaire` HTTP response open without sending headers yet** (`m=hold` in `gravy-clone`).
   - On the next 50ms poll (or at `850ms`), `/stage` receives `{"started":true}` and executes **`oldFeedReturn()` → `location.replace("snssdk1233://feed")`** (with `aweme://feed` and `aweme://__foryou` fallbacks in `gravy-clone`).
   - **Result:** Even if the user does nothing, TikTok **automatically dismisses the blank staging view and drops the user right back onto their normal For You feed**. If the user manually swiped/tapped back earlier, `pagehide` ensures `openPopup()` still fired before dismissal.
4. **T ≈ 1.5s → ~18s — User Scrolls Normal FYP While Server Holds HTTP Open:**
   - The Cloudflare Worker holds the `/delayed-questionnaire` HTTP request open for **~17.1 seconds** on `aww-funnel` (`17.114s` iOS TikTok UA, `17.312s` Desktop UA; `15.134s` on `gravy-clone`).
   - Because the pending HTTP request lives in TikTok's native `webview_popup` container (independent of the dismissed ad/stage WebView), **the popup stays alive even after the user is back on the FYP** and remains completely invisible thanks to `silent_load_type=1`.
5. **T ≈ 18s (4:42) — Delayed Full-Screen Chromeless Reveal Over FYP:**
   - After ~17.1s, the Worker releases `/delayed-questionnaire` with **`HTTP 302 Location: https://aww-funnel.3wingsandchips.workers.dev/l/fc?...`**.
   - TikTok's `webview_popup` fetches the self-contained 356 KB `/l/fc` SPA. Once navigation finishes, `silent_load_type=1` completes and **presents the full-screen chromeless WebView directly over the active FYP**.
   - **Why Screenshots 2–4 Have Zero Browser Chrome:** `hide_nav_bar=1`, `hide_title_bar=1`, `hide_more=1`, `hide_bottom_nav_bar=1`, `should_full_screen=1`, `trans_status_bar=1`, and `disable_bounces=1` strip every TikTok browser indicator. The `<` chevron on Screenshots 3 and 4 is purely an HTML `<button id="back">` rendered by `/l/fc`'s SPA (`$('back').hidden = id === 's1'`), which is why Screenshot 2 has no back button at all.

---

## 5. Native UI Mimicry, Telemetry & Store Handoff Inside `/l/fc`

Once revealed over the FYP, `/l/fc` (`stage2/aww_questionnaire__ios_tiktok_uk.html`, 356 KB single-file bundle) uses multiple TikTok-specific UX techniques:

1. **Pixel-Perfect TikTok Design System & Theme Sync:**
   - Embeds 4 subsets of TikTok's own `TikTokSans` font as inline base64 WOFF2 data URIs (`@font-face`).
   - Uses TikTok's exact CSS variable names and palette (`--Primary: #fe2c55`, `--Cyan: #25f4ee`, `--TextPrimary: #161823`, `--BGPrimary: #fff` / `#121212`).
   - Reads TikTok's proprietary In-App Browser theme UA tokens (`isDarkMode/1|0` on iOS, `AppTheme/dark|light` on Android) both server-side and client-side so the popup seamlessly matches the user's current TikTok light/dark mode on first paint.
2. **Micro-Commitment Funnel & Fake Compliance Gate:**
   - Screen 1 (`s1`): `"✓ Watch & Earn on TikTok"` / `"Your Screen Time to Cash Access Is Ready!"` / `"£20 bonus"` / `"Rewards paid by TikTok"` + randomized 2–3h countdown timer persisted in `sessionStorage["enrol_deadline_v1"]` (`02:17:11` in Screenshot 2).
   - Screen 2 (`s2`): `"Are you 18 or older?"` — **both** `#btn-yes` and `#btn-no` route identically to Screen 3 (`s3`); the under-18 screen (`s2b`) is dead code. The screen exists purely as a native-looking compliance check and micro-commitment step.
   - Screen 3 (`s3`): `"How it works"` + Freecash card (`4.6 · 21,000+ ratings`) + `"Install Freecash"` CTA (`#download`), with `contextmenu` disabled so iOS users cannot long-press to preview the affiliate redirect domain.
3. **Conversion & Anti-Fraud Telemetry:**
   - Loads TikTok Pixel `DAHJ81BC77UEK70HT9N0` (`https://analytics.tiktok.com/i18n/pixel/events.js`), firing `ttq.page()` on reveal and `ttq.track('CompleteRegistration')` on `"Install Freecash"` tap (feeding TikTok's `Lead generation` ad optimization algorithm).
   - Sends a 35-field WebView/JSBridge/WebGL/device fingerprint to `POST /fingerprint` (specifically checking `ToutiaoJSBridge`, `JS2NativeBridge`, `JSBridge.call`, `JSBridgeMessageHandler`, and `window.webkit.messageHandlers` keys).
   - Appends human-interaction metrics (`bh_dwell`, `bh_scroll`, `bh_taps`, `bh_force`, `bh_ptype`) to `/visit?...` on tap.
4. **App Store / Play Store Handoff:**
   - Tapping `"Install Freecash"` navigates `/visit` → `linkthem.net` (`offer_id=5084`, `aff_id=201951`, `s3=<ttclid>`) → `go.linkthem.net` → `freecash.com` (`utm_source=glitchy`) → Adjust (`freecash.go.link`) → native iOS App Store (`itms-apps://apps.apple.com/app/id1673567402`) or Android Play Store (`intent://...package=com.freecash.app2`), letting iOS/Android jump straight from the Spark `webview_popup` into the native store install sheet.

---

## 6. Why This Architecture Boosts CTR / CVR & Platform Policy / Enforcement Profile

### 6.1 Conversion Mechanics (Why It Outperforms Standard Landers)
- **Artificial CTR Inflation (Swipe-Bait):** Single-image Photo Ad + `"(swipe)"` caption captures accidental/reflexive left-swipes at very low CPC.
- **Cognitive Attribution Severance (The 17-Second Delay):** By returning the user to the FYP (`snssdk1233://feed`) and waiting ~17 seconds before revealing `webview_popup`, the user stops associating the screen with the ad they swiped on. Instead, it feels like an unsolicited, first-party TikTok system notification/reward unlock triggered mid-scroll.
- **Zero-Chrome Impersonation:** Removing the URL bar, `X` close button, and `...` menu while matching TikTok's exact `TikTokSans` font, light/dark UA theme token, and `#FE2C55` design tokens eliminates visual cues that the user is viewing a third-party website (`workers.dev`), driving dramatically higher click-through to the Freecash App Store page.
- **Algorithmic Feedback Loop:** Firing `ttq.track('CompleteRegistration')` on CTA click trains TikTok's ad delivery model to find users most susceptible to the popup flow.

### 6.2 TikTok Policy, Security & Enforcement Profile
This flow violates multiple high-severity TikTok Advertising Policies and platform security boundaries:
1. **Cloaking / Circumventing Systems:** Dual client+server UA gating redirecting reviewers/non-TikTok browsers to `/blogs/news`, plus double open-redirect allowlist bypass (`tiktok.com/link/v2` → `adclick.g.doubleclick.net`).
2. **Brand Impersonation & Misleading Claims:** Explicitly displaying TikTok's trademarked logo, `TikTokSans` font, `"Watch & Earn on TikTok"`, and `"Rewards paid by TikTok"` for an unaffiliated third-party GPT app (Freecash), alongside a fake countdown timer and non-functional 18+ age gate.
3. **Deceptive Ad Functionality / Swipe-Bait:** Using `(swipe)` cues on a non-carousel ad to induce unintended clicks.
4. **Abuse of Internal Deep-Link Schemes (`snssdk1233://webview_popup` + `silent_load_type=1`):** Exploits TikTok's internal Spark container flags and first-party open redirect (`/link/v2`) to hijack the FYP surface after ad dismissal and strip browser security chrome.
5. **Likely Enforcement / Remediation Vectors:**
   - **Account & Asset Bans:** TikTok Business Center / ad account suspension, Pixel `DAHJ81BC77UEK70HT9N0` ban, Shopify store/domain blocklisting, and affiliate network clawbacks (Freecash / Glitchy / Linkthem prohibit brand impersonation and deceptive TikTok-official claims).
   - **Platform-Side Technical Mitigations:** Restricting `snssdk1233://webview` / `webview_popup` scheme invocations originating from external Ad IAB `WKWebView` contexts; enforcing final-destination host checks (post-redirect) before honoring `hide_nav_bar=1` / `silent_load_type=1`; tightening `/link/v2` open-redirect policies for ad-tech redirectors like `adclick.g.doubleclick.net`; and cancelling pending `silent_load_type=1` popup containers when the spawning ad WebView is dismissed.
