import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const links = pgTable(
  'links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originalUrl: text('original_url').notNull(),
    slug: text('slug').notNull(),
    accessCount: integer('access_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('links_slug_lower_unique').on(sql`lower(slug)`),
    index('links_created_at_id_idx').on(table.createdAt.desc(), table.id.desc()),
    check('links_access_count_non_negative', sql`access_count >= 0`),
  ],
)

export type Link = typeof links.$inferSelect
