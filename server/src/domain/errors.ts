export abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly code: string
}

export class SlugAlreadyExistsError extends AppError {
  readonly statusCode = 409
  readonly code = 'SLUG_ALREADY_EXISTS'

  constructor() {
    super('This shortened URL is already in use')
  }
}

export class LinkNotFoundError extends AppError {
  readonly statusCode = 404
  readonly code = 'LINK_NOT_FOUND'

  constructor() {
    super('Link not found')
  }
}

export class StorageNotConfiguredError extends AppError {
  readonly statusCode = 503
  readonly code = 'STORAGE_NOT_CONFIGURED'

  constructor() {
    super('Report storage is not configured')
  }
}

export class ReportUploadError extends AppError {
  readonly statusCode = 502
  readonly code = 'REPORT_UPLOAD_FAILED'

  constructor(options?: ErrorOptions) {
    super('Failed to upload the report to storage', options)
  }
}
