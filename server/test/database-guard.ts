const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const TEST_DATABASE_NAME = /^[a-z0-9_]+_test$/

export const DEFAULT_TEST_DATABASE_URL = 'postgresql://brevly:brevly@localhost:5432/brevly_test'

export function getTestDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL
}

/**
 * Refuses to run tests against anything that is not a local, explicitly
 * named *_test database, so a misconfigured URL can never hit a shared or
 * production database.
 */
export function assertSafeTestDatabase(databaseUrl: string): { databaseName: string } {
  const url = new URL(databaseUrl)
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''))

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to run tests: database host "${url.hostname}" is not local`)
  }

  if (!TEST_DATABASE_NAME.test(databaseName)) {
    throw new Error(`Refusing to run tests: database "${databaseName}" must end with "_test"`)
  }

  return { databaseName }
}
