import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL || 'postgres://pkos:pkos@localhost:5433/pkos'
const client = new pg.Client({ connectionString: databaseUrl })

await client.connect()
await client.query(`
  DROP TABLE IF EXISTS
    document_tags,
    tags,
    open_questions,
    insights,
    decisions,
    action_items,
    document_projects,
    document_people,
    chunks,
    processing_jobs,
    projects,
    people,
    documents,
    schema_migrations
  CASCADE
`)
await client.end()
console.log('database reset')
