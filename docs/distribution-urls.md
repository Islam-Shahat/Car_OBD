# Repository & Distribution URLs

Date: 2026-11-15  
Status: Configured with current placeholders; pending owner confirmation.

---

## 1. Overview

All outbound repository links, release downloads, and remote configuration endpoints are centralized in:
- **Code Constants**: `src/lib/projectUrls.ts`

Before the final general availability (v1.0) release, the repository owner will confirm the exact GitHub organization/account and repository name. Changing the values in `src/lib/projectUrls.ts` automatically propagates to all frontend navigation links, update prompts, and remote configuration fetching.

---

## 2. Centralized Endpoints (`src/lib/projectUrls.ts`)

| Constant | Current Value | Purpose |
| :--- | :--- | :--- |
| `GITHUB_OWNER` | `islamshahat` | GitHub user/organization account |
| `GITHUB_REPO` | `obd-diagnose` | GitHub repository name |
| `GITHUB_REPO_URL` | `https://github.com/islamshahat/obd-diagnose` | Source code repository homepage |
| `GITHUB_RELEASES_URL` | `https://github.com/islamshahat/obd-diagnose/releases` | Release assets and installer download page |
| `GITHUB_LATEST_DOWNLOAD_URL` | `https://github.com/islamshahat/obd-diagnose/releases/latest/download/latest.json` | Tauri updater update check endpoint |
| `GITHUB_PAGES_CONFIG_URL` | `https://islamshahat.github.io/obd-diagnose/config.json` | Signed remote config distribution URL |

---

## 3. Inventory of Current Value Occurrences (`islamshahat/obd-diagnose`)

The following files contain the identifier `islamshahat/obd-diagnose` or `islamshahat`:

### Application Source Code (Now using `src/lib/projectUrls.ts`)
1. `src/lib/projectUrls.ts`: Central definitions of owner, repository, and URLs.
2. `src/lib/remoteConfig/defaults.ts`: Imports `GITHUB_PAGES_CONFIG_URL` for `DEFAULT_REMOTE_CONFIG_URL`.
3. `src/app/AppLayout.tsx`: Imports `GITHUB_RELEASES_URL` for the update announcement banner.
4. `src/features/remoteConfig/MandatoryUpdatePrompt.tsx`: Imports `GITHUB_RELEASES_URL` for the modal update action.
5. `src/features/settings/SettingsPage.tsx`: Imports `GITHUB_RELEASES_URL` for the update check link.

### Platform and Build Configurations (Static Configs)
6. `src-tauri/tauri.conf.json` (line 33):
   `"endpoints": ["https://github.com/islamshahat/obd-diagnose/releases/latest/download/latest.json"]`
   *(Must be updated in tandem when `GITHUB_OWNER` / `GITHUB_REPO` are confirmed).*
7. `src-tauri/Cargo.toml` (line 5):
   `authors = ["Islam Shahat"]`

### Documentation and Readme
8. `README.md` (lines 3, 5, 46, 95):
   - CI build status badge: `https://github.com/islamshahat/obd-diagnose/actions/workflows/build.yml/badge.svg`
   - Platform releases badge: `https://github.com/islamshahat/obd-diagnose/releases`
   - Download instruction link: `https://github.com/islamshahat/obd-diagnose/releases`
   - Clone instruction: `git clone https://github.com/islamshahat/obd-diagnose.git`
9. `docs/distribution-urls.md`: This reference document.
