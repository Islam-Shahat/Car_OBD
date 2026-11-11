/**
 * Safe, optional access to localStorage. Storage can be unavailable
 * (locked-down WebView / private mode); preferences then live in memory only.
 */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignored on purpose: failing to persist a preference must never break the UI.
  }
}
