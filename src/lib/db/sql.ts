/** Values accepted by every repository statement; booleans become 0/1. */
export type SqlValue = string | number | null;

/**
 * The only database capability the repositories need. The Tauri plugin
 * implements it with `@tauri-apps/plugin-sql`; tests implement it with
 * `node:sqlite`, so both paths run the exact same SQL and mapping code.
 */
export interface SqlExecutor {
  execute(sql: string, params?: readonly SqlValue[]): Promise<{ rowsAffected: number }>;
  select<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toSqlBool(value: boolean): number {
  return value ? 1 : 0;
}

export function fromSqlBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function stringifyJsonArray(value: readonly string[] | null | undefined): string {
  return JSON.stringify(value ?? []);
}

/** Escapes LIKE wildcards so a user search cannot turn into a match-all pattern. */
export function likeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}
