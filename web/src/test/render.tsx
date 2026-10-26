import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AppProviders, AppRoutes, createQueryClient } from '../app'
import type { Link } from '../http/links'

export const API_URL = 'http://localhost:3333'

export function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: crypto.randomUUID(),
    originalUrl: 'https://example.com/page',
    slug: 'example',
    accessCount: 0,
    createdAt: new Date('2026-01-01T12:00:00Z').toISOString(),
    ...overrides,
  }
}

export function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })
}

export interface ApiRequest {
  method: string
  path: string
  body: unknown
}

type Handler = (request: ApiRequest) => Response | Promise<Response>

/** Routes fetch calls by "METHOD /path"; unmatched calls fail the test loudly. */
export function mockApi(routes: Record<string, Handler>) {
  const requests: ApiRequest[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const request = { method, path: url.pathname, body }
    requests.push(request)

    const handler = routes[`${method} ${url.pathname}`]
    if (!handler) throw new Error(`Unexpected request: ${method} ${url.pathname}`)
    return handler(request)
  })

  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, requests }
}

export function renderApp(path = '/') {
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
  const user = userEvent.setup()

  const utils = render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  )

  return { ...utils, user, queryClient }
}
