import { eq, sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { links } from '../src/infra/database/schema.js'
import { createTestContext, TEST_WEB_URL, type TestContext } from './helpers.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()
})

afterEach(async () => {
  await ctx.cleanup()
})

afterAll(async () => {
  await ctx.close()
})

async function createLinkRequest(body: Record<string, unknown>) {
  return ctx.app.inject({ method: 'POST', url: '/links', payload: body })
}

async function createValidLink(label = 'link', originalUrl = 'https://example.com/page') {
  const slug = ctx.makeSlug(label)
  const response = await createLinkRequest({ originalUrl, slug })
  expect(response.statusCode).toBe(201)
  return response.json().link as {
    id: string
    slug: string
    originalUrl: string
    accessCount: number
    createdAt: string
  }
}

describe('POST /links', () => {
  it('creates a link with zero accesses', async () => {
    const slug = ctx.makeSlug('Portfolio')
    const response = await createLinkRequest({ originalUrl: 'https://devsite.example.com', slug })

    expect(response.statusCode).toBe(201)
    const { link } = response.json()
    expect(link).toMatchObject({
      originalUrl: 'https://devsite.example.com',
      slug,
      accessCount: 0,
    })
    expect(link.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Number.isNaN(Date.parse(link.createdAt))).toBe(false)
  })

  it.each([
    ['too short', 'ab'],
    ['with spaces', 'my link'],
    ['with slash', 'a/b/c'],
    ['with accents', 'promoção'],
    ['with dot', 'file.csv'],
    ['too long', 'a'.repeat(51)],
    ['empty', ''],
  ])('rejects a malformed slug (%s)', async (_label, slug) => {
    const response = await createLinkRequest({ originalUrl: 'https://example.com', slug })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it.each([
    ['not a URL', 'not a url'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['ftp scheme', 'ftp://example.com/file'],
    ['missing scheme', 'www.example.com'],
    ['too long', `https://example.com/${'a'.repeat(2048)}`],
  ])('rejects an invalid original URL (%s)', async (_label, originalUrl) => {
    const response = await createLinkRequest({ originalUrl, slug: ctx.makeSlug() })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('rejects a body with missing fields', async () => {
    const response = await createLinkRequest({})

    expect(response.statusCode).toBe(400)
    expect(response.json().issues.length).toBeGreaterThan(0)
  })

  it('rejects a duplicated slug with 409, ignoring case', async () => {
    const link = await createValidLink('dup')

    const sameCase = await createLinkRequest({ originalUrl: 'https://other.com', slug: link.slug })
    const otherCase = await createLinkRequest({
      originalUrl: 'https://other.com',
      slug: link.slug.toUpperCase(),
    })

    expect(sameCase.statusCode).toBe(409)
    expect(sameCase.json()).toEqual({
      code: 'SLUG_ALREADY_EXISTS',
      message: 'This shortened URL is already in use',
    })
    expect(otherCase.statusCode).toBe(409)
  })

  it('creates exactly one link when the same slug is submitted concurrently', async () => {
    const slug = ctx.makeSlug('race')

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createLinkRequest({ originalUrl: `https://example.com/${index}`, slug }),
      ),
    )

    const statuses = responses.map((response) => response.statusCode).sort()
    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(9)

    const rows = await ctx.db.select().from(links).where(eq(links.slug, slug))
    expect(rows).toHaveLength(1)
  })
})

describe('GET /links', () => {
  it('lists links ordered from newest to oldest', async () => {
    const first = await createValidLink('first')
    const second = await createValidLink('second')

    const response = await ctx.app.inject({ method: 'GET', url: '/links' })

    expect(response.statusCode).toBe(200)
    const listed: Array<{ id: string }> = response.json().links
    const ids = listed.map((link) => link.id)
    expect(ids).toContain(first.id)
    expect(ids).toContain(second.id)
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id))
    expect(listed.find((link) => link.id === first.id)).toMatchObject({
      originalUrl: first.originalUrl,
      slug: first.slug,
      accessCount: 0,
    })
  })
})

describe('GET /links/:slug', () => {
  it('resolves the original URL without counting an access', async () => {
    const link = await createValidLink('resolve', 'https://linkedin.com/in/someone')

    const response = await ctx.app.inject({ method: 'GET', url: `/links/${link.slug}` })

    expect(response.statusCode).toBe(200)
    expect(response.json().link).toMatchObject({
      id: link.id,
      originalUrl: 'https://linkedin.com/in/someone',
      accessCount: 0,
    })
  })

  it('resolves slugs case-insensitively', async () => {
    const link = await createValidLink('MixedCase')

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/links/${link.slug.toUpperCase()}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().link.id).toBe(link.id)
  })

  it('returns 404 for an unknown slug', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/links/${ctx.makeSlug('missing')}`,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ code: 'LINK_NOT_FOUND', message: 'Link not found' })
  })

  it('returns 400 for a malformed slug', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/links/a%20b' })

    expect(response.statusCode).toBe(400)
  })
})

describe('DELETE /links/:id', () => {
  it('deletes a link', async () => {
    const link = await createValidLink('delete')

    const response = await ctx.app.inject({ method: 'DELETE', url: `/links/${link.id}` })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')

    const resolve = await ctx.app.inject({ method: 'GET', url: `/links/${link.slug}` })
    expect(resolve.statusCode).toBe(404)
  })

  it('returns 404 when the link does not exist', async () => {
    const response = await ctx.app.inject({
      method: 'DELETE',
      url: '/links/00000000-0000-4000-8000-000000000000',
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 400 for an invalid id', async () => {
    const response = await ctx.app.inject({ method: 'DELETE', url: '/links/not-a-uuid' })

    expect(response.statusCode).toBe(400)
  })
})

describe('POST /links/:id/accesses', () => {
  it('increments the access count by one per call', async () => {
    const link = await createValidLink('count')

    const first = await ctx.app.inject({ method: 'POST', url: `/links/${link.id}/accesses` })
    const second = await ctx.app.inject({ method: 'POST', url: `/links/${link.id}/accesses` })

    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ id: link.id, accessCount: 1 })
    expect(second.json()).toEqual({ id: link.id, accessCount: 2 })

    const resolve = await ctx.app.inject({ method: 'GET', url: `/links/${link.slug}` })
    expect(resolve.json().link.accessCount).toBe(2)
  })

  it('does not lose increments under concurrency', async () => {
    const link = await createValidLink('concurrent')
    const total = 50

    const responses = await Promise.all(
      Array.from({ length: total }, () =>
        ctx.app.inject({ method: 'POST', url: `/links/${link.id}/accesses` }),
      ),
    )

    expect(responses.every((response) => response.statusCode === 200)).toBe(true)
    const [row] = await ctx.db
      .select({ accessCount: links.accessCount })
      .from(links)
      .where(eq(links.id, link.id))
    expect(row?.accessCount).toBe(total)

    const returnedCounts = responses
      .map((response) => response.json().accessCount)
      .sort((a, b) => a - b)
    expect(returnedCounts).toEqual(Array.from({ length: total }, (_, index) => index + 1))
  })

  it('returns 404 for an unknown link', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/links/00000000-0000-4000-8000-000000000000/accesses',
    })

    expect(response.statusCode).toBe(404)
  })
})

describe('CORS', () => {
  it('allows the configured web origin', async () => {
    const response = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/links',
      headers: { origin: TEST_WEB_URL, 'access-control-request-method': 'DELETE' },
    })

    expect(response.headers['access-control-allow-origin']).toBe(TEST_WEB_URL)
    expect(String(response.headers['access-control-allow-methods'])).toContain('DELETE')
  })

  it('does not allow other origins', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/links',
      headers: { origin: 'https://evil.example.com' },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('database constraints', () => {
  it('enforces slug uniqueness at the database level', async () => {
    const link = await createValidLink('constraint')

    await expect(
      ctx.db.insert(links).values({ originalUrl: 'https://x.com', slug: link.slug.toUpperCase() }),
    ).rejects.toThrow()
  })

  it('defaults access_count to zero and created_at to now', async () => {
    const slug = ctx.makeSlug('defaults')
    const [row] = await ctx.db
      .insert(links)
      .values({ originalUrl: 'https://x.com', slug })
      .returning({
        accessCount: links.accessCount,
        createdAt: links.createdAt,
        now: sql<Date>`now()`,
      })

    expect(row?.accessCount).toBe(0)
    expect(row?.createdAt).toBeInstanceOf(Date)
  })
})
