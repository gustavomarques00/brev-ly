import { env } from '../env'

const frontendBaseUrl = env.VITE_FRONTEND_URL.replace(/\/+$/, '')

/** Host shown before the slug, e.g. "brev.ly/". */
export const shortUrlPrefix = `${frontendBaseUrl.replace(/^https?:\/\//i, '')}/`

export function buildShortUrl(slug: string): string {
  return `${frontendBaseUrl}/${encodeURIComponent(slug)}`
}

export function displayShortUrl(slug: string): string {
  return `${shortUrlPrefix}${slug}`
}

export function displayOriginalUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export function formatAccessCount(count: number): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'acesso' : 'acessos'}`
}
