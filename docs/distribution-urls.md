# Repository & Distribution URLs

Date: 2026-11-18  
Status: Configured for repository `Islam-Shahat/Car_OBD`.

---

## 1. Overview

All outbound repository links, release downloads, and remote configuration endpoints are centralized in:

- **Code Constants**: `src/lib/projectUrls.ts`

Changing the values in `src/lib/projectUrls.ts` automatically propagates to all frontend navigation links, update prompts, and remote configuration fetching.

---

## 2. Centralized Endpoints (`src/lib/projectUrls.ts`)

| Constant                     | Value                                                                          | Purpose                                    |
| :--------------------------- | :----------------------------------------------------------------------------- | :----------------------------------------- |
| `GITHUB_OWNER`               | `Islam-Shahat`                                                                 | GitHub owner account (cased for URLs)      |
| `GITHUB_PAGES_OWNER`         | `islam-shahat`                                                                 | GitHub Pages subdomain (lowercase)         |
| `GITHUB_REPO`                | `Car_OBD`                                                                      | GitHub repository name                     |
| `GITHUB_REPO_URL`            | `https://github.com/Islam-Shahat/Car_OBD`                                      | Source code repository homepage            |
| `GITHUB_RELEASES_URL`        | `https://github.com/Islam-Shahat/Car_OBD/releases`                             | Release assets and installer download page |
| `GITHUB_LATEST_DOWNLOAD_URL` | `https://github.com/Islam-Shahat/Car_OBD/releases/latest/download/latest.json` | Tauri updater update check endpoint        |
| `GITHUB_PAGES_CONFIG_URL`    | `https://islam-shahat.github.io/Car_OBD/config.json`                           | Signed remote config distribution URL      |

---

## 3. Platform Configurations and Endpoints

The following platform and build configurations point directly to these endpoints:

### Application Source Code

1. `src/lib/projectUrls.ts`: Central definitions of owner, repository, and URLs.
2. `src/lib/remoteConfig/defaults.ts`: Imports `GITHUB_PAGES_CONFIG_URL` for `DEFAULT_REMOTE_CONFIG_URL`.
3. `src/app/AppLayout.tsx`: Imports `GITHUB_RELEASES_URL` for the update announcement banner.
4. `src/features/remoteConfig/MandatoryUpdatePrompt.tsx`: Imports `GITHUB_RELEASES_URL` for the modal update action.
5. `src/features/settings/SettingsPage.tsx`: Imports `GITHUB_RELEASES_URL` for the update check link.

### Platform and Build Configurations

6. `src-tauri/tauri.conf.json`:
   `"endpoints": ["https://github.com/Islam-Shahat/Car_OBD/releases/latest/download/latest.json"]`
7. `src-tauri/Cargo.toml`:
   `repository = "https://github.com/Islam-Shahat/Car_OBD"`
8. `package.json`:
   `"repository": { "type": "git", "url": "https://github.com/Islam-Shahat/Car_OBD.git" }`
