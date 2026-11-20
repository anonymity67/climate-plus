/** D1 batches are atomic. Migrations are external to request handling. */
export function createD1Store(binding) {
  if (!binding?.prepare || !binding?.batch) throw new Error('D1 binding unavailable');
  const statement = (sql, params = []) => binding.prepare(sql).bind(...params);
  return {
    get: (sql, params = []) => statement(sql, params).first(),
    all: async (sql, params = []) => (await statement(sql, params).all()).results,
    run: async (sql, params = []) => ({
      changes: (await statement(sql, params).run()).meta.changes,
    }),
    batch: async (entries) =>
      (await binding.batch(entries.map(({ sql, params }) => statement(sql, params)))).map(
        (result) => ({ changes: result.meta.changes }),
      ),
  };
}
