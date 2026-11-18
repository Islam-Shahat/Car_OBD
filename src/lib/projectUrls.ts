/**
 * Centralized repository, distribution, and remote configuration endpoints.
 *
 * NOTE: Do not change values manually in individual components.
 * The project maintainer will confirm the exact GitHub owner and repository name
 * prior to publication; update these constants centrally.
 */

export const GITHUB_OWNER = 'Islam-Shahat';
export const GITHUB_PAGES_OWNER = 'islam-shahat';
export const GITHUB_REPO = 'Car_OBD';

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const GITHUB_LATEST_DOWNLOAD_URL = `${GITHUB_REPO_URL}/releases/latest/download/latest.json`;
export const GITHUB_PAGES_CONFIG_URL = `https://${GITHUB_PAGES_OWNER}.github.io/${GITHUB_REPO}/config.json`;
