import { DatabaseSync } from 'node:sqlite';

import type { SqlExecutor, SqlValue } from '../../src/lib/db/sql';

/**
 * The Tauri SQL plugin uses `$1` placeholders; node:sqlite only accepts `?1`
 * with positional arrays. Translating here means every repository statement is
 * executed byte-for-byte the same way in tests and in production.
 */
function positional(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?$1');
}

export interface TestDatabase extends SqlExecutor {
  readonly raw: DatabaseSync;
  close(): void;
}

export function createTestDatabase(path = ':memory:'): TestDatabase {
  const raw = new DatabaseSync(path);
  // Mirrors SQLite's production defaults closely enough for the repository
  // constraints under test; foreign keys stay off as they do in the app.
  raw.exec('PRAGMA journal_mode = MEMORY');
  raw.exec('PRAGMA busy_timeout = 2000');

  return {
    raw,
    execute(sql, params: readonly SqlValue[] = []) {
      const statement = raw.prepare(positional(sql));
      const result = statement.run(...params);
      return Promise.resolve({ rowsAffected: Number(result.changes) });
    },
    select<T>(sql: string, params: readonly SqlValue[] = []) {
      const statement = raw.prepare(positional(sql));
      return Promise.resolve(statement.all(...params) as T[]);
    },
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = await work();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      raw.close();
    },
  };
}
