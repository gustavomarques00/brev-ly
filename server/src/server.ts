import { buildApp } from './app.js'
import { parseEnv } from './env.js'
import { createDatabase } from './infra/database/client.js'
import { createR2StorageFromEnv } from './infra/storage/r2-storage.js'

const env = parseEnv()
const { db, pg } = createDatabase(env.DATABASE_URL)
const storage = createR2StorageFromEnv(env)

const app = await buildApp({
  db,
  pg,
  storage,
  webUrl: env.WEB_URL,
  corsOrigins: [new URL(env.WEB_URL).origin],
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
})

if (!storage) {
  app.log.warn('Cloudflare R2 variables are not set: CSV export will respond with 503')
}

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`)
  await app.close()
  await pg.end({ timeout: 5 })
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

await app.listen({ host: env.HOST, port: env.PORT })
