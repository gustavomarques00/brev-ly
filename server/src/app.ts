import cors from '@fastify/cors'
import fastify, { type FastifyServerOptions } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { Sql } from 'postgres'
import { errorHandler } from './http/error-handler.js'
import { linksRoutes } from './http/routes/links.js'
import type { Database } from './infra/database/client.js'
import type { FileStorage } from './infra/storage/storage.js'

export interface AppDependencies {
  db: Database
  pg: Sql
  storage: FileStorage | null
  webUrl: string
}

export interface BuildAppOptions extends AppDependencies {
  corsOrigins: string[]
  logger?: FastifyServerOptions['logger']
}

export async function buildApp({ corsOrigins, logger = false, ...deps }: BuildAppOptions) {
  const app = fastify({ logger, bodyLimit: 16 * 1024 }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)

  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'DELETE'],
  })

  app.get('/health', async () => ({ status: 'ok' }))
  await app.register(linksRoutes(deps))

  return app
}
