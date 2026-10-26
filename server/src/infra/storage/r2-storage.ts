import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { Env } from '../../env.js'
import type { FileStorage } from './storage.js'

const REQUEST_TIMEOUT_MS = 30_000
const CONNECTION_TIMEOUT_MS = 5_000

/** Returns null when any required R2 variable is missing. */
export function createR2StorageFromEnv(env: Env): FileStorage | null {
  const {
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_ACCESS_KEY_ID: accessKeyId,
    CLOUDFLARE_SECRET_ACCESS_KEY: secretAccessKey,
    CLOUDFLARE_BUCKET: bucket,
    CLOUDFLARE_PUBLIC_URL: publicUrl,
    CLOUDFLARE_ENDPOINT: customEndpoint,
  } = env

  if (!accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null
  if (!accountId && !customEndpoint) return null

  const client = new S3Client({
    region: 'auto',
    endpoint: customEndpoint ?? `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(customEndpoint),
    credentials: { accessKeyId, secretAccessKey },
    requestHandler: {
      requestTimeout: REQUEST_TIMEOUT_MS,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
    },
  })

  const publicBaseUrl = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`

  return {
    async upload({ key, contentType, contentDisposition, body }) {
      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentDisposition: contentDisposition,
        },
      })

      await upload.done()

      return { key, url: new URL(key, publicBaseUrl).toString() }
    },
  }
}
