import { z } from 'zod'

const envSchema = z.object({
  VITE_FRONTEND_URL: z.url({ protocol: /^https?$/ }),
  VITE_BACKEND_URL: z.url({ protocol: /^https?$/ }),
})

export const env = envSchema.parse(import.meta.env)
