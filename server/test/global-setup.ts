import postgres from 'postgres'
import { runMigrations } from '../src/infra/database/migrate.js'
import { assertSafeTestDatabase, getTestDatabaseUrl } from './database-guard.js'

export default async function setup() {
  const databaseUrl = getTestDatabaseUrl()
  const { databaseName } = assertSafeTestDatabase(databaseUrl)

  const maintenanceUrl = new URL(databaseUrl)
  maintenanceUrl.pathname = '/postgres'
  const admin = postgres(maintenanceUrl.toString(), { max: 1, onnotice: () => {} })

  try {
    const existing = await admin`select 1 from pg_database where datname = ${databaseName}`
    if (existing.length === 0) {
      await admin.unsafe(`create database "${databaseName}"`)
    }
  } finally {
    await admin.end()
  }

  await runMigrations(databaseUrl)
}
