import { z } from 'zod'

/**
 * Slug rule shared (by convention) with web/src/schemas/link.ts:
 * 3 to 50 characters among ASCII letters, digits, "-" and "_".
 * Uniqueness and lookups are case-insensitive (see the lower(slug) index).
 */
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{3,50}$/

export const ORIGINAL_URL_MAX_LENGTH = 2048

export const slugSchema = z
  .string()
  .trim()
  .regex(SLUG_PATTERN, 'Slug must have 3-50 characters: letters, numbers, "-" or "_"')

export const originalUrlSchema = z
  .string()
  .trim()
  .max(ORIGINAL_URL_MAX_LENGTH)
  .pipe(z.url({ protocol: /^https?$/, error: 'Original URL must be a valid http(s) URL' }))
