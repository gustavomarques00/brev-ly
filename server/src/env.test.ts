import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.js'
import { createR2StorageFromEnv } from './infra/storage/r2-storage.js'

const base = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/db' }

describe('parseEnv', () => {
  it('applies defaults and treats empty Cloudflare values as unset', () => {
    const env = parseEnv({ ...base, CLOUDFLARE_BUCKET: '', CLOUDFLARE_PUBLIC_URL: '' })

    expect(env.PORT).toBe(3333)
    expect(env.WEB_URL).toBe('http://localhost:5173')
    expect(env.CLOUDFLARE_BUCKET).toBeUndefined()
    expect(createR2StorageFromEnv(env)).toBeNull()
  })

  it('rejects an invalid DATABASE_URL without echoing its value', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://secret-value@host/db' })).toThrow(
      'Invalid environment variables: DATABASE_URL',
    )
    expect(() => parseEnv({ DATABASE_URL: 'mysql://secret-value@host/db' })).not.toThrow(
      /secret-value/,
    )
  })

  it('creates the R2 storage when every variable is present', () => {
    const env = parseEnv({
      ...base,
      CLOUDFLARE_ACCOUNT_ID: 'account',
      CLOUDFLARE_ACCESS_KEY_ID: 'key',
      CLOUDFLARE_SECRET_ACCESS_KEY: 'secret',
      CLOUDFLARE_BUCKET: 'bucket',
      CLOUDFLARE_PUBLIC_URL: 'https://pub.example.com',
    })

    expect(createR2StorageFromEnv(env)).not.toBeNull()
  })
})
