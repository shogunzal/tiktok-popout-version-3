# TikTok Popout Version 3 — Forensic Research Archive

Read-only archival snapshot of the reverse-engineering reports, HTTP probe matrices, IOCs, and raw captured payloads from the `8sebgr-sx.myshopify.com` / `aww-funnel.3wingsandchips.workers.dev` / `gravy-clone.3wingsandchips.workers.dev` investigation and comparison against `webview-kit-funnel.zip` and `play-earn-funnel.zip`.

> **Note:** This repository is a static forensic archive of observed evidence and analysis reports — not a runnable or deployable application.

## Contents

### `reports/`
- `lander_deepdive_report.md` — End-to-end technical deep dive, Mermaid sequence diagram, Spark flag breakdown, and IOCs.
- `zip_comparison_report.md` — 4-way evolutionary comparison (`play-earn-funnel.zip`, `webview-kit-funnel.zip`, `gravy-clone`, `aww-funnel`).
- `execution_trace.md` — Line-by-line static execution trace of live payloads.
- `tiktok_ux_analysis.md` — TikTok In-App Browser (Spark/WKWebView), deep-link, and ad-delivery analysis.
- `fetcher_index.md` — Summary index of all live HTTP probes and hold timings.
- `webview_kit_analysis.md` — Forensic dissection of `webview-kit-funnel.zip`.
- `play_earn_analysis.md` — Forensic dissection of `play-earn-funnel.zip`.

### `captures/deobfuscator/`
- Extracted Shopify pages (`shopify_page_goh.html`, `shopify_page_go.html`, `goh_full_ios_tiktok_main.html`, `blogs_news_ios_tiktok_main.html`).
- Clean `/l/fc` SPA HTML (`aww_questionnaire_clean.html`) and extracted inline scripts (`aww_questionnaire_script_0..3.js`, `gravy_questionnaire_script_0..4.js`).
- Decoded deep-link chain (`decoded_native_url_chain.json`), IOCs (`iocs.json`), and passive OSINT (`urlscan_3wingsandchips.json`).

### `captures/fetcher/`
- Shopify & Worker UA cloaking matrices (`matrix_summary.json`, `workers/worker_matrix_summary.json`).
- Raw `entryHTML`, `/stage` captures (`stage2/`), ~17.1s `/delayed-questionnaire` timing logs (`stage3/`), and full affiliate redirect hops (`stage4_visit/visit_chains.json`).
