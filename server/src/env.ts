import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const optionalString = z.preprocess(emptyToUndefined, z.string().optional())
const optionalUrl = z.preprocess(emptyToUndefined, z.url({ protocol: /^https?$/ }).optional())

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  WEB_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:5173'),

  CLOUDFLARE_ACCOUNT_ID: optionalString,
  CLOUDFLARE_ACCESS_KEY_ID: optionalString,
  CLOUDFLARE_SECRET_ACCESS_KEY: optionalString,
  CLOUDFLARE_BUCKET: optionalString,
  CLOUDFLARE_PUBLIC_URL: optionalUrl,
  CLOUDFLARE_ENDPOINT: optionalUrl,
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const invalidKeys = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Invalid environment variables: ${invalidKeys}`)
  }

  return result.data
}
