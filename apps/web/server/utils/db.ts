import pg from 'pg'

let pool: pg.Pool | undefined

export function getPool() {
  if (!pool) {
    const config = useRuntimeConfig()
    pool = new pg.Pool({ connectionString: config.databaseUrl })
  }
  return pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params)
}

export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

