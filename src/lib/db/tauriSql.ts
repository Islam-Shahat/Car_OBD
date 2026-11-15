import type Database from '@tauri-apps/plugin-sql';

import type { SqlExecutor, SqlValue } from './sql';

/**
 * Thin adapter over `@tauri-apps/plugin-sql`. The repositories never import the
 * plugin directly, which is what lets tests run the same SQL on `node:sqlite`.
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
}
