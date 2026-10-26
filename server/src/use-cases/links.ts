import { desc, eq, sql } from 'drizzle-orm'
import { LinkNotFoundError, SlugAlreadyExistsError } from '../domain/errors.js'
import type { Database } from '../infra/database/client.js'
import { type Link, links } from '../infra/database/schema.js'

export interface CreateLinkInput {
  originalUrl: string
  slug: string
}

export async function createLink(db: Database, input: CreateLinkInput): Promise<Link> {
  // The lower(slug) unique index is the source of truth: a concurrent insert
  // of the same slug hits the conflict instead of passing a pre-check.
  const [created] = await db
    .insert(links)
    .values({ originalUrl: input.originalUrl, slug: input.slug })
    .onConflictDoNothing()
    .returning()

  if (!created) throw new SlugAlreadyExistsError()

  return created
}

export async function listLinks(db: Database): Promise<Link[]> {
  return db.select().from(links).orderBy(desc(links.createdAt), desc(links.id))
}

export async function getLinkBySlug(db: Database, slug: string): Promise<Link> {
  const [link] = await db
    .select()
    .from(links)
    .where(eq(sql`lower(${links.slug})`, slug.toLowerCase()))
    .limit(1)

  if (!link) throw new LinkNotFoundError()

  return link
}

export async function deleteLink(db: Database, id: string): Promise<void> {
  const deleted = await db.delete(links).where(eq(links.id, id)).returning({ id: links.id })

  if (deleted.length === 0) throw new LinkNotFoundError()
}

export async function registerLinkAccess(
  db: Database,
  id: string,
): Promise<{ id: string; accessCount: number }> {
  const [updated] = await db
    .update(links)
    .set({ accessCount: sql`${links.accessCount} + 1` })
    .where(eq(links.id, id))
    .returning({ id: links.id, accessCount: links.accessCount })

  if (!updated) throw new LinkNotFoundError()

  return updated
}
