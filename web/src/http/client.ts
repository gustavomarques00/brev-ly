import { env } from '../env'

const REQUEST_TIMEOUT_MS = 15_000
const baseUrl = env.VITE_BACKEND_URL.replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function request<T>(
  path: string,
  { method = 'GET', body, signal }: RequestOptions = {},
) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    // Only send a JSON content type when there is a body: Fastify rejects
    // empty bodies declared as application/json.
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string
      message?: string
    } | null
    throw new ApiError(response.status, payload?.code, payload?.message ?? response.statusText)
  }

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}
