import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export function createDatabase(databaseUrl: string) {
  const pg = postgres(databaseUrl, { max: 10, onnotice: () => {} })
  const db = drizzle({ client: pg, schema })

  return { db, pg }
}

export type DatabaseConnection = ReturnType<typeof createDatabase>
export type Database = DatabaseConnection['db']
