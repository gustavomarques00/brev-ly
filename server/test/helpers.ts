import { randomBytes } from 'node:crypto'
import type { Readable } from 'node:stream'
import { sql } from 'drizzle-orm'
import { buildApp } from '../src/app.js'
import { createDatabase } from '../src/infra/database/client.js'
import { links } from '../src/infra/database/schema.js'
import type { FileStorage, UploadFileInput } from '../src/infra/storage/storage.js'
import { assertSafeTestDatabase, getTestDatabaseUrl } from './database-guard.js'

export const TEST_WEB_URL = 'http://localhost:5173'
export const TEST_PUBLIC_URL = 'https://reports.example.test'

export async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

export interface FakeStorage extends FileStorage {
  uploads: Array<Omit<UploadFileInput, 'body'> & { content: string }>
  failWith: Error | null
}

export function createFakeStorage(): FakeStorage {
  const storage: FakeStorage = {
    uploads: [],
    failWith: null,
    async upload({ body, ...metadata }) {
      if (storage.failWith) {
        body.resume()
        throw storage.failWith
      }
      const content = await readStream(body)
      storage.uploads.push({ ...metadata, content })
      return { key: metadata.key, url: new URL(metadata.key, `${TEST_PUBLIC_URL}/`).toString() }
    },
  }
  return storage
}

/**
 * Every slug created by a test context starts with a random prefix, so cleanup
 * deletes only the records this context created.
 */
export async function createTestContext() {
  const databaseUrl = getTestDatabaseUrl()
  assertSafeTestDatabase(databaseUrl)

  const { db, pg } = createDatabase(databaseUrl)
  const storage = createFakeStorage()
  const prefix = `t${randomBytes(4).toString('hex')}`
  let sequence = 0

  const app = await buildApp({
    db,
    pg,
    storage,
    webUrl: TEST_WEB_URL,
    corsOrigins: [TEST_WEB_URL],
  })

  return {
    app,
    db,
    pg,
    storage,
    makeSlug: (label = 'link') => `${prefix}-${label}-${++sequence}`,
    async cleanup() {
      await db.delete(links).where(sql`lower(${links.slug}) like ${`${prefix}-%`}`)
    },
    async close() {
      await this.cleanup()
      await app.close()
      await pg.end()
    },
  }
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>
