/** Accept a Node 24 DatabaseSync; no schema changes occur here. */
export function createSqliteStore(database) {
  return {
    get: async (sql, params = []) => database.prepare(sql).get(...params) ?? null,
    all: async (sql, params = []) => database.prepare(sql).all(...params),
    run: async (sql, params = []) => ({
      changes: Number(database.prepare(sql).run(...params).changes),
    }),
    batch: async (entries) => {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = entries.map(({ sql, params = [] }) => ({
          changes: Number(database.prepare(sql).run(...params).changes),
        }));
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
