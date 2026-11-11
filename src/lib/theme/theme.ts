import { readStored, writeStored } from '../storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'obd.theme';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Pure resolution of what the user picked plus the OS setting. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}

export function storedThemePreference(): ThemePreference {
  const stored = readStored(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

export function saveThemePreference(preference: ThemePreference): void {
  writeStored(THEME_STORAGE_KEY, preference);
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Runs before the first render so the shell never flashes the wrong theme. */
export function applyStoredTheme(): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyResolvedTheme(resolveTheme(storedThemePreference(), prefersDark));
}
