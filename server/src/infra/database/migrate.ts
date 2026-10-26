import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDatabase } from './client.js'

const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url))

export async function runMigrations(databaseUrl: string) {
  const { db, pg } = createDatabase(databaseUrl)

  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await pg.end()
  }
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url)

if (isEntryPoint) {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('DATABASE_URL is required to run migrations')
    process.exit(1)
  }

  runMigrations(databaseUrl)
    .then(() => console.log('Migrations applied'))
    .catch((error: unknown) => {
      console.error('Failed to apply migrations:', error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
