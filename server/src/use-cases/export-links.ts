import { randomUUID } from 'node:crypto'
import { PassThrough, Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { stringify } from 'csv-stringify'
import { desc } from 'drizzle-orm'
import type { Sql } from 'postgres'
import { ReportUploadError, StorageNotConfiguredError } from '../domain/errors.js'
import type { Database } from '../infra/database/client.js'
import { links } from '../infra/database/schema.js'
import type { FileStorage } from '../infra/storage/storage.js'

export const CSV_COLUMNS = [
  { key: 'originalUrl', header: 'URL original' },
  { key: 'shortUrl', header: 'URL encurtada' },
  { key: 'accessCount', header: 'Contagem de acessos' },
  { key: 'createdAt', header: 'Data de criação' },
] as const

const CURSOR_BATCH_SIZE = 500
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

/** Neutralizes spreadsheet formula injection (OWASP "CSV Injection"). */
export function escapeCsvFormula(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value
}

export function buildShortUrl(webUrl: string, slug: string): string {
  const base = webUrl.endsWith('/') ? webUrl : `${webUrl}/`
  return new URL(encodeURIComponent(slug), base).toString()
}

export function generateReportKey(now = new Date()): string {
  const datePrefix = now.toISOString().slice(0, 10)
  return `reports/links-${datePrefix}-${randomUUID()}.csv`
}

interface ExportLinksDeps {
  db: Database
  pg: Sql
  storage: FileStorage | null
  webUrl: string
}

interface LinkRow {
  original_url: string
  slug: string
  access_count: number
  created_at: Date | string
}

export async function exportLinks({ db, pg, storage, webUrl }: ExportLinksDeps) {
  if (!storage) throw new StorageNotConfiguredError()

  const query = db
    .select({
      originalUrl: links.originalUrl,
      slug: links.slug,
      accessCount: links.accessCount,
      createdAt: links.createdAt,
    })
    .from(links)
    .orderBy(desc(links.createdAt), desc(links.id))
    .toSQL()

  // Rows are fetched in batches through a server-side cursor so memory stays
  // bounded regardless of table size.
  async function* rows() {
    const cursor = pg
      .unsafe<LinkRow[]>(query.sql, query.params as never[])
      .cursor(CURSOR_BATCH_SIZE)

    for await (const batch of cursor) {
      for (const row of batch) {
        yield {
          originalUrl: escapeCsvFormula(row.original_url),
          shortUrl: escapeCsvFormula(buildShortUrl(webUrl, row.slug)),
          accessCount: row.access_count,
          createdAt: new Date(row.created_at).toISOString(),
        }
      }
    }
  }

  const key = generateReportKey()
  const fileName = key.split('/').pop() ?? key
  const body = new PassThrough()

  const csv = stringify({
    header: true,
    bom: true,
    columns: CSV_COLUMNS.map(({ key, header }) => ({ key, header })),
  })

  const upload = storage
    .upload({
      key,
      contentType: 'text/csv; charset=utf-8',
      contentDisposition: `attachment; filename="${fileName}"`,
      body,
    })
    .catch((error: unknown) => {
      throw new ReportUploadError({ cause: error })
    })

  try {
    const [, uploaded] = await Promise.all([pipeline(Readable.from(rows()), csv, body), upload])
    return { reportUrl: uploaded.url, fileName }
  } catch (error) {
    body.destroy()
    throw error
  }
}
