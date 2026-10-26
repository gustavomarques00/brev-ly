import { z } from 'zod'

/** Mirrors server/src/domain/link-rules.ts. */
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{3,50}$/
export const ORIGINAL_URL_MAX_LENGTH = 2048

export const SLUG_RULE_MESSAGE = 'Use de 3 a 50 caracteres: letras, números, "-" ou "_".'

export function isValidSlug(value: string | undefined): value is string {
  return value !== undefined && SLUG_PATTERN.test(value)
}

/** Accepts "www.site.com" (as in the Figma placeholder) by assuming https. */
export function normalizeOriginalUrl(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '' || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function isSafeHttpUrl(value: string): boolean {
  const url = parseUrl(value)
  return url !== null && (url.protocol === 'http:' || url.protocol === 'https:')
}

function hasPublicLookingHost(value: string): boolean {
  return parseUrl(value)?.hostname.includes('.') ?? false
}

export const newLinkFormSchema = z.object({
  originalUrl: z
    .string()
    .trim()
    .min(1, 'Informe a URL original.')
    .transform(normalizeOriginalUrl)
    .pipe(
      z
        .string()
        .max(ORIGINAL_URL_MAX_LENGTH, 'A URL é muito longa.')
        .refine(
          (value) => isSafeHttpUrl(value) && hasPublicLookingHost(value),
          'Informe uma URL válida.',
        ),
    ),
  slug: z.string().trim().min(1, 'Informe a URL encurtada.').regex(SLUG_PATTERN, SLUG_RULE_MESSAGE),
})

export type NewLinkFormInput = z.input<typeof newLinkFormSchema>
export type NewLinkFormOutput = z.output<typeof newLinkFormSchema>
