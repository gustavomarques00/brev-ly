import { request } from './client'

export interface Link {
  id: string
  originalUrl: string
  slug: string
  accessCount: number
  createdAt: string
}

export async function listLinks(signal?: AbortSignal) {
  const { links } = await request<{ links: Link[] }>('/links', { signal })
  return links
}

export async function createLink(input: { originalUrl: string; slug: string }) {
  const { link } = await request<{ link: Link }>('/links', { method: 'POST', body: input })
  return link
}

export async function deleteLink(id: string) {
  await request<void>(`/links/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function getLinkBySlug(slug: string, signal?: AbortSignal) {
  const { link } = await request<{ link: Link }>(`/links/${encodeURIComponent(slug)}`, { signal })
  return link
}

export async function registerLinkAccess(id: string) {
  return request<{ id: string; accessCount: number }>(`/links/${encodeURIComponent(id)}/accesses`, {
    method: 'POST',
  })
}

export async function exportLinksReport() {
  return request<{ reportUrl: string; fileName: string }>('/links/exports', { method: 'POST' })
}
