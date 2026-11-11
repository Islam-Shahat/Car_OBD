# Phase 1 — Scaffold, tooling and app shell

Goal: a runnable Windows shell with the final stack, Arabic-first RTL UI, theme, routing and
quality gates, before any car communication.

## Delivered

- **Stack**: Tauri v2 (Rust host) + React 19 + TypeScript 5.9 (strict) + Vite 8 + Tailwind 4.
  Tauri chosen over Electron for installer size and RAM; WebView2 is the runtime.
- **Routing**: hash router (`src/app/router.tsx`) with Connect, Scan, History and Settings.
- **i18n**: i18next + react-i18next, Arabic default, English toggle from the sidebar.
  `<html lang dir>` is driven by the selected language; CSS uses logical properties.
  Arabic and English resources are key- and placeholder-identical (unit-tested).
- **Fonts**: Cairo variable subsets (Arabic + Latin) bundled locally; no CDN.
- **Theme**: light / dark / system via React context + `dark` class + `localStorage`.
- **Shell**: sidebar navigation with icons, page headers, offline badge, version label,
  diagnosis-only disclaimer.
- **Tooling**: ESLint 10 + typescript-eslint (strict, no `any`), Prettier, Vitest, `tsc -b`
  typecheck, `npm run build`, `cargo fmt`/`clippy` gates, Windows CI workflow with installer
  size summary and artifact upload.
- **Docs**: `docs/architecture.md`, `CLAUDE.md` (copy of `AGENTS.md`).

## Verification

| Check                  | Result                      |
| ---------------------- | --------------------------- |
| `npm run typecheck`    | Passed                      |
| `npm run lint`         | Passed                      |
| `npm run format:check` | Passed                      |
| `npm test`             | 9 tests passed at the time  |
| `npm run build`        | Passed                      |
| RTL/dark UI screenshot | Verified in browser preview |

## Bundle and runtime size

Filled after the first `npm run tauri build`:

<!-- BUNDLE_SIZES -->

First release build (`npm run tauri build`, release profile with LTO/strip/panic=abort):

| Artifact                                  | Size    |
| ----------------------------------------- | ------- |
| `obd-diagnose.exe` (application binary)   | 3.18 MB |
| `OBD Diagnose_0.1.0_x64-setup.exe` (NSIS) | 1.28 MB |
| `OBD Diagnose_0.1.0_x64_en-US.msi` (WiX)  | 1.79 MB |

Idle memory measured 10 s after launch, window open, no connection:

| Metric                                        | Value   |
| --------------------------------------------- | ------- |
| Working set, app + WebView2 child processes   | ~380 MB |
| Private bytes, app + WebView2 child processes | ~180 MB |

The raw working-set sum double-counts shared WebView2 pages; private bytes is the better
comparison with other desktop apps. WebView2 accounts for almost all of it (the Rust host
itself is ~30 MB working set).

## Known gaps / risks

- Application icons are still the default Tauri placeholders; no branded icon yet.
- Installers are unsigned, so Windows SmartScreen warns on first run.
- The CI workflow has not run on GitHub (no repository/remote yet).
- The webview preview (Vite in a normal browser) cannot access COM ports; the connection
  screen shows a clear message there. Port listing works only inside the Tauri app.
- `npm audit` reports 10 moderate advisories in the dev dependency tree; not investigated.
