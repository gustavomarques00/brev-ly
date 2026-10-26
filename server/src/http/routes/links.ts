import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { AppDependencies } from '../../app.js'
import { originalUrlSchema, slugSchema } from '../../domain/link-rules.js'
import type { Link } from '../../infra/database/schema.js'
import { exportLinks } from '../../use-cases/export-links.js'
import {
  createLink,
  deleteLink,
  getLinkBySlug,
  listLinks,
  registerLinkAccess,
} from '../../use-cases/links.js'

const linkResponseSchema = z.object({
  id: z.uuid(),
  originalUrl: z.string(),
  slug: z.string(),
  accessCount: z.number().int(),
  createdAt: z.string(),
})

const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
})

const linkIdParamsSchema = z.object({ id: z.uuid() })

function toLinkResponse(link: Link) {
  return { ...link, createdAt: link.createdAt.toISOString() }
}

export function linksRoutes({ db, pg, storage, webUrl }: AppDependencies): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      '/links',
      {
        schema: {
          body: z.object({ originalUrl: originalUrlSchema, slug: slugSchema }),
          response: {
            201: z.object({ link: linkResponseSchema }),
            409: errorResponseSchema,
          },
        },
      },
      async (request, reply) => {
        const link = await createLink(db, request.body)
        return reply.status(201).send({ link: toLinkResponse(link) })
      },
    )

    app.get(
      '/links',
      {
        schema: {
          response: { 200: z.object({ links: z.array(linkResponseSchema) }) },
        },
      },
      async () => {
        const links = await listLinks(db)
        return { links: links.map(toLinkResponse) }
      },
    )

    app.get(
      '/links/:slug',
      {
        schema: {
          params: z.object({ slug: slugSchema }),
          response: { 200: z.object({ link: linkResponseSchema }), 404: errorResponseSchema },
        },
      },
      async (request) => {
        const link = await getLinkBySlug(db, request.params.slug)
        return { link: toLinkResponse(link) }
      },
    )

    app.delete(
      '/links/:id',
      {
        schema: {
          params: linkIdParamsSchema,
          response: { 204: z.null(), 404: errorResponseSchema },
        },
      },
      async (request, reply) => {
        await deleteLink(db, request.params.id)
        return reply.status(204).send(null)
      },
    )

    app.post(
      '/links/:id/accesses',
      {
        schema: {
          params: linkIdParamsSchema,
          response: {
            200: z.object({ id: z.uuid(), accessCount: z.number().int() }),
            404: errorResponseSchema,
          },
        },
      },
      async (request) => registerLinkAccess(db, request.params.id),
    )

    app.post(
      '/links/exports',
      {
        schema: {
          response: {
            201: z.object({ reportUrl: z.url(), fileName: z.string() }),
            502: errorResponseSchema,
            503: errorResponseSchema,
          },
        },
      },
      async (_request, reply) => {
        const report = await exportLinks({ db, pg, storage, webUrl })
        return reply.status(201).send(report)
      },
    )
  }
}
