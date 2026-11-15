import type Database from '@tauri-apps/plugin-sql';

import type { SqlExecutor, SqlValue } from './sql';

/**
 * Thin adapter over `@tauri-apps/plugin-sql`. The repositories never import the
 * plugin directly, which is what lets tests run the same SQL on `node:sqlite`.
 *
 * The plugin (2.6.0) exposes a connection pool and no transaction API, so the
 * transaction statements go through the same executor. Every call is awaited in
 * order, and SQLite's pool hands the idle connection back for the next
 * statement, which keeps BEGIN/COMMIT on one connection in the app. The seed
 * verifies the row count after the commit, so a rollback or a lost connection
 * can never be recorded as a completed seed. If the plugin gains concurrent
 * database work, this belongs in a Rust command instead.
 */
export class TauriSqlExecutor implements SqlExecutor {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async execute(sql: string, params: readonly SqlValue[] = []): Promise<{ rowsAffected: number }> {
    const result = await this.database.execute(sql, [...params]);
    return { rowsAffected: result.rowsAffected };
  }

  async select<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.database.select<T[]>(sql, [...params]);
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    await this.database.execute('BEGIN IMMEDIATE');
    try {
      const result = await work();
      await this.database.execute('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.database.execute('ROLLBACK');
      } catch {
        // The original error already explains the failure; a rollback error on
        // an aborted transaction must not hide it.
      }
      throw error;
    }
  }
}
