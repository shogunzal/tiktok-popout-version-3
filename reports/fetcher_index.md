# Fetcher Capture Index & Live Probe Matrix

Base directory: `/Users/zal/.gemini/antigravity/brain/69654e87-2d60-4aea-875d-73ac736c0c8d/scratch/fetcher/`

All probes executed from UK egress (`CF-RAY: *-LHR`, Shopify `localization=GB`, `cart_currency=GBP`).

---

## 1. Shopify Front-Door Cloaking Matrix (`matrix_summary.json`, `responses/`, `extracted/`)

- **Target store**: `https://8sebgr-sx.myshopify.com` (Shopify CDN behind Cloudflare; HTTP layer does **not** cloak by UA/Referer/params).
- **29 HTTP probes executed** across `desktop_chrome`, `ios_tiktok_uk`, `ios_tiktok_alt`, `android_tiktok_uk`, `ios_safari_uk` on:
  - `/pages/goh` (full TikTok query string, clean, `ttclid` only, `px=p2` only, `utm_source=tiktok&s1=...` only): all `200`, ~169 KB.
  - `/blogs/news`: all `200`, 167,024 B (empty benign Shopify blog white-page).
  - `/`: `200`, 282,257 B.
  - `/pages/go`: `200`, 166,744 B (`workers/shopify_pages_go__ios_tiktok_uk.html`).
  - `/robots.txt` (`200`, 3,735 B), `/sitemap.xml` (`200`, 780 B), `/sitemap_pages_1.xml` (`200`, 652 B), `/sitemap_blogs_1.xml` (`200`, 332 B), `/sitemap_collections_1.xml` (`200`, 342 B), `/blogs/news.atom` (`200`, 545 B), `/products.json` (`200`, `{"products":[]}`), `/blogs.json` (`404`), `/blogs/news/articles.json` (`404`).
  - `/pages.json` (`responses/body_cdc915cf1b89114f.json`, `200`, 10,426 B): exposes **3 pages** (`contact`, `go`, `goh`) with completely unobfuscated inline HTML/JS and developer comments:
    - `extracted/shopify_page_goh.html` (active production, updated `2026-11-23T07:04:05+00:00`) -> `WORKER_BASE = "https://aww-funnel.3wingsandchips.workers.dev"`.
    - `extracted/shopify_page_go.html` (earlier prototype, updated `2026-11-22T11:51:50+00:00`) -> `WORKER_URL = "https://gravy-clone.3wingsandchips.workers.dev"`.
- **PWA / Service Worker absence confirmed**:
  - `GET /manifest.json` and `GET /sw.js` return `404` on both `8sebgr-sx.myshopify.com` and `aww-funnel.3wingsandchips.workers.dev` (`stage4_visit/visit_chains.json`).
  - Zero `Service-Worker-Allowed` headers and zero `<link rel="manifest">` tags anywhere in the chain.

---

## 2. Cloudflare Worker Cloaking Matrix (`workers/worker_matrix_summary.json`, `workers/`)

### Production Worker: `https://aww-funnel.3wingsandchips.workers.dev`
| Probe | Method | Profile | Status | Result | File |
|---|---|---|---|---|---|
| `/shopify-entry` (full `goh` URL) | POST | `ios_tiktok_uk` | 200 | `authorized:true`, `preserveNativeContext:true`, `productionFlow:"aww-v1"`, `entryHTML` (1,983 B), `nativeURL`, `stageURL`, `questionnaireURL`, `flowID` | `workers/aww_entry_goh_full__ios_tiktok_uk.json` & `.entryHTML.html` |
| `/shopify-entry` (full `goh` URL) | POST | `android_tiktok_uk` | 200 | `authorized:true`, identical schema (`entryHTML` 1,983 B) | `workers/aww_entry_goh_full__android_tiktok_uk.json` |
| `/shopify-entry` (full `goh` URL) | POST | `desktop_chrome` | 200 | `authorized:false`, `fallback:"https://8sebgr-sx.myshopify.com/blogs/news"` | `workers/aww_entry_goh_full__desktop_chrome.json` |
| `/shopify-entry` (full `goh` URL) | POST | `ios_safari_uk` | 200 | `authorized:false`, `fallback:"https://8sebgr-sx.myshopify.com/blogs/news"` | `workers/aww_entry_goh_full__ios_safari_uk.json` |
| `/shopify-entry` (full `goh` + `&k=demo`) | POST | `ios_tiktok_uk` | 200 | `authorized:true` | `workers/aww_entry_goh_kdemo__ios_tiktok_uk.json` |
| `/shopify-entry` (clean `/pages/goh`, no params) | POST | `ios_tiktok_uk` | 200 | `authorized:true` (`entryHTML` 1,256 B) | `workers/aww_entry_goh_clean__ios_tiktok_uk.json` |
| `GET /` | GET | `ios_tiktok_uk` | 302 | `Location: https://aww-funnel.3wingsandchips.workers.dev/?k=demo` | `workers/aww_get_root__ios_tiktok_uk.meta.json` |
| `GET /?k=demo` | GET | `ios_tiktok_uk` | 200 | 2,870 B HTML loader | `stage2/aww_root_kdemo__ios_tiktok_uk.html` |
| `GET /?k=demo` | GET | `desktop_chrome` | 404 | 0 B (UA-cloaked!) | `stage2/aww_root_kdemo__desktop_chrome.meta.json` |
| `GET /l/fc` | GET | `ios_tiktok_uk` & `desktop_chrome` | 200 | 354,885 B (356,186 B with query params) self-contained Freecash SPA (`X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`) | `stage2/aww_questionnaire__ios_tiktok_uk.html`, `workers/aww_get_l_fc__ios_tiktok_uk.html` |

Key headers on `/shopify-entry`: `Access-Control-Allow-Origin: https://8sebgr-sx.myshopify.com`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`.

### Prototype Worker: `https://gravy-clone.3wingsandchips.workers.dev`
- `POST /shopify-entry` (`k=demo`): returns `authorized:true`, `productionFlow:"gravy-clone-v1"` for all 3 UAs (`ios_tiktok_uk`, `android_tiktok_uk`, `desktop_chrome`) — less strict than `aww-funnel`.
- `GET /stage` (`stage2/gravy_stage__ios_tiktok_uk.html`, 4,207 B): exposes backup variant plumbing (`popup`/`popupa`/`full`/`lynx`/`blank`, `m=hold`, `FEEDS=['snssdk1233://feed','aweme://feed','aweme://__foryou']`).
- `GET /questionnaire` (`stage2/gravy_questionnaire__ios_tiktok_uk.html`, 41,374 B): placeholder `https://REPLACE-OFFER-URL.example/go`.

---

## 3. Open-Redirect Bypass & Stage-2 Capture (`stage2/stage2_summary.json`, `stage2/`)

- `entryHTML` fires `location.replace("snssdk1233://webview?url=...&use_spark=1&use_forest=1&...&hide_nav_bar=1&hide_title_bar=1&hide_bottom_nav_bar=1&hide_status_bar=1&should_full_screen=1&isLinkFullScreen=1&landPageShowType=2")`.
- **Hop 1 (`stage2/hop_tiktok_link_v2__ios_tiktok_uk.meta.json`)**:
  - `GET https://www.tiktok.com/link/v2?aid=1988&lang=en&scene=bio_url&target=https%3A%2F%2Fadclick.g.doubleclick.net%2Fpcs%2Fclick%3F...`
  - Live `302` -> `https://adclick.g.doubleclick.net/pcs/click?adurl=%2F%2Faww-funnel.3wingsandchips.workers.dev%2Fstage%3F...`
- **Hop 2 (`stage2/hop_doubleclick__ios_tiktok_uk.meta.json`)**:
  - `GET https://adclick.g.doubleclick.net/pcs/click?adurl=%2F%2Faww-funnel.3wingsandchips.workers.dev%2Fstage%3F...`
  - Live `302` -> `//aww-funnel.3wingsandchips.workers.dev/stage?ref=...&slot=0&s1=...&ttclid=...&px=p2&cid=...`
- **Stage page (`stage2/aww_stage__ios_tiktok_uk.html`, 3,275 B)**:
  - Fires `snssdk1233://webview_popup?url=https%3A%2F%2Fadclick.g.doubleclick.net%2Fpcs%2Fclick%3Fadurl%3D...%2Fdelayed-questionnaire...&...&silent_load_type=1`.
  - Polls `/flow-load-started?ref=...` every 50 ms (850 ms timeout) and redirects the visible WebView via `location.replace('snssdk1233://feed')`.

---

## 4. Server-Side Hold Timing & State Flip (`stage3/stage3_summary.json`, `stage3/`)

| Probe | Status | Elapsed | Body / Location | File |
|---|---|---|---|---|
| `aww` `/flow-load-started` (before) | 200 | 0.27 s | `{"started":false}` | `stage3/aww_flow_started_before.json` |
| `aww` `/delayed-questionnaire` (`ios_tiktok_uk`) | **302** | **17.11 s** | `Location: https://aww-funnel.3wingsandchips.workers.dev/l/fc?s1=1882654792241361&cid=E_C_P_TEST_PROBE&px=p2&slot=0` | `stage3/aww_delayed_questionnaire__ios_tt.meta.json` |
| `aww` `/flow-load-started` (after) | 200 | 0.10 s | `{"started":true}` | `stage3/aww_flow_started_after.json` |
| `aww` `/delayed-questionnaire` (`desktop_chrome`) | **302** | **17.31 s** | `Location: https://aww-funnel.3wingsandchips.workers.dev/l/fc?px=p2&slot=0` | `stage3/aww_delayed_questionnaire__desktop.meta.json` |
| `gravy` `/flow-load-started` (before) | 200 | 0.31 s | `{"started":false}` | `stage3/gravy_flow_started_before.json` |
| `gravy` `/delayed-questionnaire?m=hold` (`ios_tiktok_uk`) | **302** | **15.13 s** | `Location: https://gravy-clone.3wingsandchips.workers.dev/questionnaire` | `stage3/gravy_delayed_questionnaire__ios_tt.meta.json` |
| `gravy` `/flow-load-started` (after) | 200 | 0.27 s | `{"started":true}` | `stage3/gravy_flow_started_after.json` |

---

## 5. Final Affiliate Offer Chain (`stage4_visit/visit_chains.json`, `stage4_visit/`)

Static asset scan (`stage3/asset_scan.json`): `/l/fc` is a single self-contained HTML SPA; the only external script URL is `https://analytics.tiktok.com/i18n/pixel/events.js`, and CTA clicks hit `/visit?slot=0&sub2=<ttclid>&ttclid=<ttclid>&px=p2&bh_dwell=...&bh_scroll=...&bh_taps=...&bh_force=...&bh_ptype=touch`.

Live redirect hops captured across iOS TikTok, Android TikTok, Desktop Chrome, and low-behavior params (all 4 redirect identically through Hop 2; platform branching occurs at `freecash.com` Hop 3):
- **Hop 0**: `GET https://aww-funnel.3wingsandchips.workers.dev/visit?...` -> `302` `https://linkthem.net/?offer_id=5084&aff_id=201951&s3=<ttclid>`
- **Hop 1**: `GET https://linkthem.net/?offer_id=5084&aff_id=201951&s3=...` -> `302` `https://go.linkthem.net/aff_c?offer_id=5084&aff_id=201951&aff_click_id=gt_04_...`
- **Hop 2**: `GET https://go.linkthem.net/aff_c?...` -> `302` `https://freecash.com?utm_source=glitchy&utm_medium=cpa&utm_campaign=FC_GLITCHY_RON_WW_TIER15_APP_REV1_21_08_2026&click_id=<click_id>&sub1=201951&sub2=&sub4=`
- **Hop 3 (iOS & Android)**: `GET https://freecash.com?...` -> `302` `https://freecash.go.link/?adj_t=1tx4w2qo_1uyf6g9q&adj_campaign=FC_GLITCHY_RON_WW_TIER15_APP_REV1_21_08_2026&adj_adgroup=fc-app&adj_label=source%3Aglitchy%7Cclick_id%3A...%7Csub1%3A201951%7Csub2%3A%7Csub4%3Atiktok`
- **Hop 4 (iOS)**: `200` Adjust interstitial (`stage4_visit/visit_ios_tiktok_uk_hop4.html`) -> `itms-apps://apps.apple.com/app/id1673567402?mt=...` (Freecash iOS App Store).
- **Hop 4 (Android)**: `302` -> `intent://...#Intent;scheme=freecash;package=com.freecash.app2;...S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.freecash.app2...;end`.
- **Hop 3–4 (Desktop Chrome)**: `302` -> `https://freecash.com/en?...` (`200`, 369,844 B).
