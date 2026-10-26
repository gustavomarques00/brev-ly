import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  buildShortUrl,
  CSV_COLUMNS,
  escapeCsvFormula,
  generateReportKey,
} from '../src/use-cases/export-links.js'
import { createTestContext, TEST_PUBLIC_URL, TEST_WEB_URL, type TestContext } from './helpers.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()
})

afterEach(async () => {
  ctx.storage.uploads.length = 0
  ctx.storage.failWith = null
  await ctx.cleanup()
})

afterAll(async () => {
  await ctx.close()
})

function parseCsv(content: string): string[][] {
  return content
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(','))
}

async function createLink(slug: string, originalUrl: string) {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/links',
    payload: { slug, originalUrl },
  })
  expect(response.statusCode).toBe(201)
  return response.json().link as { id: string; createdAt: string }
}

describe('POST /links/exports', () => {
  it('uploads a CSV with the expected header and rows and returns its public URL', async () => {
    const slug = ctx.makeSlug('Report')
    const link = await createLink(slug, 'https://example.com/report')
    await ctx.app.inject({ method: 'POST', url: `/links/${link.id}/accesses` })
    await ctx.app.inject({ method: 'POST', url: `/links/${link.id}/accesses` })

    const response = await ctx.app.inject({ method: 'POST', url: '/links/exports' })

    expect(response.statusCode).toBe(201)
    const { reportUrl, fileName } = response.json()
    expect(ctx.storage.uploads).toHaveLength(1)

    const upload = ctx.storage.uploads[0]
    expect(upload?.contentType).toBe('text/csv; charset=utf-8')
    expect(upload?.contentDisposition).toBe(`attachment; filename="${fileName}"`)
    expect(reportUrl).toBe(`${TEST_PUBLIC_URL}/${upload?.key}`)

    const [header, ...rows] = parseCsv(upload?.content ?? '')
    expect(header).toEqual([
      'URL original',
      'URL encurtada',
      'Contagem de acessos',
      'Data de criação',
    ])

    const row = rows.find((columns) => columns[1] === `${TEST_WEB_URL}/${slug}`)
    expect(row).toEqual([
      'https://example.com/report',
      `${TEST_WEB_URL}/${slug}`,
      '2',
      new Date(link.createdAt).toISOString(),
    ])
  })

  it('writes every row, even beyond one cursor batch', async () => {
    const total = 520
    const slugs = Array.from({ length: total }, () => ctx.makeSlug('bulk'))
    await Promise.all(slugs.map((slug) => createLink(slug, 'https://example.com/bulk')))

    const response = await ctx.app.inject({ method: 'POST', url: '/links/exports' })
    expect(response.statusCode).toBe(201)

    const shortUrls = new Set(parseCsv(ctx.storage.uploads[0]?.content ?? '').map((row) => row[1]))
    for (const slug of slugs) {
      expect(shortUrls.has(`${TEST_WEB_URL}/${slug}`)).toBe(true)
    }
  })

  it('generates a different file name for each export', async () => {
    await createLink(ctx.makeSlug('unique'), 'https://example.com')

    const first = await ctx.app.inject({ method: 'POST', url: '/links/exports' })
    const second = await ctx.app.inject({ method: 'POST', url: '/links/exports' })

    expect(first.json().fileName).not.toBe(second.json().fileName)
    expect(first.json().reportUrl).not.toBe(second.json().reportUrl)
  })

  it('responds 502 without leaking details when the storage upload fails', async () => {
    ctx.storage.failWith = new Error('SignatureDoesNotMatch: secret=abc123')

    const response = await ctx.app.inject({ method: 'POST', url: '/links/exports' })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({
      code: 'REPORT_UPLOAD_FAILED',
      message: 'Failed to upload the report to storage',
    })
    expect(response.body).not.toContain('abc123')
  })
})

describe('export without storage configured', () => {
  it('responds 503', async () => {
    const { buildApp } = await import('../src/app.js')
    const app = await buildApp({
      db: ctx.db,
      pg: ctx.pg,
      storage: null,
      webUrl: TEST_WEB_URL,
      corsOrigins: [TEST_WEB_URL],
    })

    const response = await app.inject({ method: 'POST', url: '/links/exports' })
    await app.close()

    expect(response.statusCode).toBe(503)
    expect(response.json().code).toBe('STORAGE_NOT_CONFIGURED')
  })
})

describe('export helpers', () => {
  it('declares the CSV columns required by the challenge', () => {
    expect(CSV_COLUMNS.map((column) => column.key)).toEqual([
      'originalUrl',
      'shortUrl',
      'accessCount',
      'createdAt',
    ])
  })

  it('generates random, unique and CSV-suffixed report keys', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateReportKey()))

    expect(keys.size).toBe(1000)
    for (const key of keys) {
      expect(key).toMatch(/^reports\/links-\d{4}-\d{2}-\d{2}-[0-9a-f-]{36}\.csv$/)
    }
  })

  it.each([
    ['=HYPERLINK("http://x")', `'=HYPERLINK("http://x")`],
    ['+1+1', `'+1+1`],
    ['-cmd', `'-cmd`],
    ['@SUM(A1)', `'@SUM(A1)`],
    ['https://safe.example.com', 'https://safe.example.com'],
  ])('escapes spreadsheet formulas: %s', (input, expected) => {
    expect(escapeCsvFormula(input)).toBe(expected)
  })

  it('builds short URLs from the web URL with or without trailing slash', () => {
    expect(buildShortUrl('https://brev.ly', 'abc')).toBe('https://brev.ly/abc')
    expect(buildShortUrl('https://brev.ly/', 'abc')).toBe('https://brev.ly/abc')
  })
})
