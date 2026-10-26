import type { Readable } from 'node:stream'

export interface UploadFileInput {
  key: string
  contentType: string
  contentDisposition?: string
  body: Readable
}

export interface UploadFileResult {
  key: string
  url: string
}

export interface FileStorage {
  upload(input: UploadFileInput): Promise<UploadFileResult>
}
