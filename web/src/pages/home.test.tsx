import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, makeLink, mockApi, renderApp } from '../test/render'
import { downloadFile } from '../utils/browser'

vi.mock('../utils/browser', () => ({ redirectTo: vi.fn(), downloadFile: vi.fn() }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('Home page — listing', () => {
  it('shows a loading indicator, then the empty state with CSV export disabled', async () => {
    const pending = deferred<Response>()
    mockApi({ 'GET /links': () => pending.promise })

    renderApp('/')

    expect(screen.getByText('Carregando links...')).toBeInTheDocument()

    pending.resolve(jsonResponse(200, { links: [] }))

    expect(await screen.findByText('Ainda não existem links cadastrados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /baixar csv/i })).toBeDisabled()
  })

  it('lists links with short URL, original URL and access count', async () => {
    mockApi({
      'GET /links': () =>
        jsonResponse(200, {
          links: [
            makeLink({
              slug: 'Portfolio-Dev',
              originalUrl: 'https://devsite.example.com/me',
              accessCount: 30,
            }),
            makeLink({
              slug: 'Linkedin-Profile',
              originalUrl: 'https://linkedin.com/in/me',
              accessCount: 1,
            }),
          ],
        }),
    })

    renderApp('/')

    const list = await screen.findByRole('list', { name: 'Links cadastrados' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByRole('link')).toHaveTextContent(
      'localhost:5173/Portfolio-Dev',
    )
    expect(within(rows[0] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      'http://localhost:5173/Portfolio-Dev',
    )
    expect(rows[0]).toHaveTextContent('devsite.example.com/me')
    expect(rows[0]).toHaveTextContent('30 acessos')
    expect(rows[1]).toHaveTextContent('1 acesso')
    expect(screen.getByRole('button', { name: /baixar csv/i })).toBeEnabled()
  })

  it('shows an error state with retry when the list request fails', async () => {
    let calls = 0
    mockApi({
      'GET /links': () => {
        calls += 1
        return calls === 1
          ? jsonResponse(500, { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' })
          : jsonResponse(200, { links: [makeLink({ slug: 'recovered' })] })
      },
    })

    const { user } = renderApp('/')

    expect(await screen.findByText('Não foi possível carregar os links')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('localhost:5173/recovered')).toBeInTheDocument()
  })
})

describe('Home page — creating links', () => {
  it('creates a link, normalizes the URL, resets the form and shows it in the list', async () => {
    const { requests } = mockApi({
      'GET /links': () => jsonResponse(200, { links: [] }),
      'POST /links': ({ body }) => {
        const input = body as { originalUrl: string; slug: string }
        return jsonResponse(201, { link: makeLink(input) })
      },
    })

    const { user } = renderApp('/')
    await screen.findByText('Ainda não existem links cadastrados')

    await user.type(screen.getByLabelText('Link original'), 'www.exemplo.com.br')
    await user.type(screen.getByLabelText('Link encurtado'), 'Meu-Link_1')
    await user.click(screen.getByRole('button', { name: 'Salvar link' }))

    expect(await screen.findByText('Link criado com sucesso')).toBeInTheDocument()
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      originalUrl: 'https://www.exemplo.com.br',
      slug: 'Meu-Link_1',
    })
    expect(screen.getByText('localhost:5173/Meu-Link_1')).toBeInTheDocument()
    expect(screen.getByLabelText('Link original')).toHaveValue('')
    expect(screen.getByLabelText('Link encurtado')).toHaveValue('')
  })

  it.each([
    ['with spaces', 'meu link'],
    ['with accents', 'promoção'],
    ['too short', 'ab'],
    ['with slash', 'a/b'],
  ])('blocks submission of a malformed slug (%s)', async (_label, slug) => {
    const { requests } = mockApi({ 'GET /links': () => jsonResponse(200, { links: [] }) })

    const { user } = renderApp('/')
    await screen.findByText('Ainda não existem links cadastrados')

    await user.type(screen.getByLabelText('Link original'), 'https://example.com')
    await user.type(screen.getByLabelText('Link encurtado'), slug)
    await user.click(screen.getByRole('button', { name: 'Salvar link' }))

    expect(
      await screen.findByText('Use de 3 a 50 caracteres: letras, números, "-" ou "_".'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Link encurtado')).toHaveAttribute('aria-invalid', 'true')
    expect(requests.some((request) => request.method === 'POST')).toBe(false)
  })

  it('blocks submission of an invalid or unsafe original URL', async () => {
    const { requests } = mockApi({ 'GET /links': () => jsonResponse(200, { links: [] }) })

    const { user } = renderApp('/')
    await screen.findByText('Ainda não existem links cadastrados')

    await user.type(screen.getByLabelText('Link original'), 'javascript:alert(1)')
    await user.type(screen.getByLabelText('Link encurtado'), 'valid-slug')
    await user.click(screen.getByRole('button', { name: 'Salvar link' }))

    expect(await screen.findByText('Informe uma URL válida.')).toBeInTheDocument()
    expect(requests.some((request) => request.method === 'POST')).toBe(false)
  })

  it('shows the conflict message on the slug field when the API answers 409', async () => {
    mockApi({
      'GET /links': () => jsonResponse(200, { links: [] }),
      'POST /links': () =>
        jsonResponse(409, {
          code: 'SLUG_ALREADY_EXISTS',
          message: 'This shortened URL is already in use',
        }),
    })

    const { user } = renderApp('/')
    await screen.findByText('Ainda não existem links cadastrados')

    await user.type(screen.getByLabelText('Link original'), 'example.com')
    await user.type(screen.getByLabelText('Link encurtado'), 'taken')
    await user.click(screen.getByRole('button', { name: 'Salvar link' }))

    expect(await screen.findByText('Essa URL encurtada já existe.')).toBeInTheDocument()
    expect(screen.getByLabelText('Link encurtado')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Link encurtado')).toHaveValue('taken')
  })

  it('disables the form while saving and reports server errors', async () => {
    const pending = deferred<Response>()
    mockApi({
      'GET /links': () => jsonResponse(200, { links: [] }),
      'POST /links': () => pending.promise,
    })

    const { user } = renderApp('/')
    await screen.findByText('Ainda não existem links cadastrados')

    await user.type(screen.getByLabelText('Link original'), 'example.com')
    await user.type(screen.getByLabelText('Link encurtado'), 'slow-link')
    await user.click(screen.getByRole('button', { name: 'Salvar link' }))

    expect(await screen.findByRole('button', { name: 'Salvando...' })).toBeDisabled()
    expect(screen.getByLabelText('Link original')).toBeDisabled()

    pending.resolve(jsonResponse(500, { code: 'INTERNAL_SERVER_ERROR', message: 'boom' }))

    expect(await screen.findByText('Erro ao criar o link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar link' })).toBeEnabled()
  })
})

describe('Home page — row actions', () => {
  it('deletes a link after confirmation, blocking the row while pending', async () => {
    const link = makeLink({ slug: 'to-delete' })
    const pending = deferred<Response>()
    const { requests } = mockApi({
      'GET /links': () => jsonResponse(200, { links: [link] }),
      [`DELETE /links/${link.id}`]: () => pending.promise,
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { user } = renderApp('/')
    const deleteButton = await screen.findByRole('button', {
      name: 'Apagar link localhost:5173/to-delete',
    })

    await user.click(deleteButton)

    expect(confirmSpy).toHaveBeenCalledWith(
      'Você realmente quer apagar o link localhost:5173/to-delete?',
    )
    await waitFor(() => expect(deleteButton).toBeDisabled())
    expect(
      screen.getByRole('button', { name: 'Copiar link localhost:5173/to-delete' }),
    ).toBeDisabled()

    pending.resolve(jsonResponse(204))

    expect(await screen.findByText('Ainda não existem links cadastrados')).toBeInTheDocument()
    expect(requests.filter((request) => request.method === 'DELETE')).toHaveLength(1)
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const link = makeLink({ slug: 'keep-me' })
    const { requests } = mockApi({ 'GET /links': () => jsonResponse(200, { links: [link] }) })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const { user } = renderApp('/')
    await user.click(
      await screen.findByRole('button', { name: 'Apagar link localhost:5173/keep-me' }),
    )

    expect(screen.getByText('localhost:5173/keep-me')).toBeInTheDocument()
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false)
  })

  it('reports a failed deletion and keeps the link', async () => {
    const link = makeLink({ slug: 'stays' })
    mockApi({
      'GET /links': () => jsonResponse(200, { links: [link] }),
      [`DELETE /links/${link.id}`]: () => jsonResponse(500, { code: 'X', message: 'boom' }),
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { user } = renderApp('/')
    await user.click(
      await screen.findByRole('button', { name: 'Apagar link localhost:5173/stays' }),
    )

    expect(await screen.findByText('Erro ao remover o link')).toBeInTheDocument()
    expect(screen.getByText('localhost:5173/stays')).toBeInTheDocument()
  })

  it('copies the full short URL and gives feedback', async () => {
    mockApi({ 'GET /links': () => jsonResponse(200, { links: [makeLink({ slug: 'copy-me' })] }) })

    const { user } = renderApp('/')
    await user.click(
      await screen.findByRole('button', { name: 'Copiar link localhost:5173/copy-me' }),
    )

    expect(await navigator.clipboard.readText()).toBe('http://localhost:5173/copy-me')
    expect(await screen.findByText('Link copiado com sucesso')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Link localhost:5173/copy-me copiado' }),
    ).toBeInTheDocument()
  })
})

describe('Home page — CSV export', () => {
  it('requests the report and downloads the returned URL', async () => {
    const pending = deferred<Response>()
    mockApi({
      'GET /links': () => jsonResponse(200, { links: [makeLink()] }),
      'POST /links/exports': () => pending.promise,
    })

    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: /baixar csv/i }))

    expect(await screen.findByRole('button', { name: /gerando/i })).toBeDisabled()

    pending.resolve(
      jsonResponse(201, {
        reportUrl: 'https://cdn.example.com/reports/links-x.csv',
        fileName: 'links-x.csv',
      }),
    )

    expect(await screen.findByText('Relatório gerado')).toBeInTheDocument()
    expect(downloadFile).toHaveBeenCalledWith(
      'https://cdn.example.com/reports/links-x.csv',
      'links-x.csv',
    )
  })

  it('shows an error when the export fails', async () => {
    mockApi({
      'GET /links': () => jsonResponse(200, { links: [makeLink()] }),
      'POST /links/exports': () =>
        jsonResponse(502, { code: 'REPORT_UPLOAD_FAILED', message: 'Failed' }),
    })

    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: /baixar csv/i }))

    expect(await screen.findByText('Erro ao gerar o CSV')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /baixar csv/i })).toBeEnabled()
  })
})
