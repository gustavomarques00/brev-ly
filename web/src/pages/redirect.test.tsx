import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, makeLink, mockApi, renderApp } from '../test/render'
import { redirectTo } from '../utils/browser'

vi.mock('../utils/browser', () => ({ redirectTo: vi.fn(), downloadFile: vi.fn() }))

beforeEach(() => {
  vi.mocked(redirectTo).mockClear()
})

describe('Redirect page', () => {
  it('shows the redirecting state, registers one access and redirects', async () => {
    const link = makeLink({ slug: 'Portfolio-Dev', originalUrl: 'https://devsite.example.com/me' })
    const { requests } = mockApi({
      'GET /links/Portfolio-Dev': () => jsonResponse(200, { link }),
      [`POST /links/${link.id}/accesses`]: () => jsonResponse(200, { id: link.id, accessCount: 1 }),
    })

    renderApp('/Portfolio-Dev')

    expect(screen.getByRole('heading', { name: 'Redirecionando...' })).toBeInTheDocument()
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://devsite.example.com/me'))

    expect(requests.filter((request) => request.path.endsWith('/accesses'))).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Acesse aqui' })).toHaveAttribute(
      'href',
      'https://devsite.example.com/me',
    )
  })

  it('still redirects when registering the access fails', async () => {
    const link = makeLink({ slug: 'flaky' })
    mockApi({
      'GET /links/flaky': () => jsonResponse(200, { link }),
      [`POST /links/${link.id}/accesses`]: () => jsonResponse(500, { code: 'X', message: 'boom' }),
    })

    renderApp('/flaky')

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith(link.originalUrl))
  })

  it('shows the not found page for an unknown slug', async () => {
    mockApi({
      'GET /links/unknown-slug': () =>
        jsonResponse(404, { code: 'LINK_NOT_FOUND', message: 'Link not found' }),
    })

    renderApp('/unknown-slug')

    expect(await screen.findByRole('heading', { name: 'Link não encontrado' })).toBeInTheDocument()
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('shows the not found page for a malformed slug without calling the API', async () => {
    const { fetchMock } = mockApi({})

    renderApp('/x')

    expect(screen.getByRole('heading', { name: 'Link não encontrado' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses to redirect to a non-http URL', async () => {
    const link = makeLink({ slug: 'evil', originalUrl: 'javascript:alert(1)' })
    const { requests } = mockApi({ 'GET /links/evil': () => jsonResponse(200, { link }) })

    renderApp('/evil')

    expect(await screen.findByRole('heading', { name: 'Link não encontrado' })).toBeInTheDocument()
    expect(redirectTo).not.toHaveBeenCalled()
    expect(requests.some((request) => request.path.endsWith('/accesses'))).toBe(false)
  })

  it('retries server errors automatically, then shows a retryable error', async () => {
    const automaticAttempts = 3
    let calls = 0
    const link = makeLink({ slug: 'retry-me' })
    mockApi({
      'GET /links/retry-me': () => {
        calls += 1
        return calls <= automaticAttempts
          ? jsonResponse(503, { code: 'X', message: 'down' })
          : jsonResponse(200, { link })
      },
      [`POST /links/${link.id}/accesses`]: () => jsonResponse(200, { id: link.id, accessCount: 1 }),
    })

    const { user } = renderApp('/retry-me')

    expect(
      await screen.findByRole('heading', { name: 'Algo deu errado' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(calls).toBe(automaticAttempts)
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith(link.originalUrl))
  })
})

describe('Unknown routes', () => {
  it('renders the not found page for nested paths', () => {
    mockApi({})

    renderApp('/some/nested/path')

    expect(screen.getByRole('heading', { name: 'Link não encontrado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'brev.ly' })).toHaveAttribute('href', '/')
  })
})
