import type { FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { AppError } from '../domain/errors.js'

type ErrorHandler = Parameters<FastifyInstance['setErrorHandler']>[0]

export const errorHandler: ErrorHandler = (error, request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      issues: error.validation.map((issue) => ({
        path: issue.instancePath,
        message: issue.message,
      })),
    })
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) request.log.error({ err: error }, error.message)
    return reply.status(error.statusCode).send({ code: error.code, message: error.message })
  }

  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number(error.statusCode)
      : 500

  if (statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({
      code: 'BAD_REQUEST',
      message: error instanceof Error ? error.message : 'Bad request',
    })
  }

  request.log.error({ err: error }, 'Unhandled error')
  return reply.status(500).send({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' })
}
