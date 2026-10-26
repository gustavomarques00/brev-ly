import { describe, expect, it } from 'vitest'
import { isSafeHttpUrl, isValidSlug, newLinkFormSchema, normalizeOriginalUrl } from './link'

describe('slug rule', () => {
  it.each(['abc', 'Portfolio-Dev', 'my_link_2', 'a'.repeat(50)])('accepts %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true)
  })

  it.each(['ab', 'a'.repeat(51), 'with space', 'acentuação', 'a/b', 'file.csv', ''])(
    'rejects %s',
    (slug) => {
      expect(isValidSlug(slug)).toBe(false)
    },
  )
})

describe('original URL', () => {
  it('assumes https when the scheme is omitted', () => {
    expect(normalizeOriginalUrl(' www.site.com.br/path ')).toBe('https://www.site.com.br/path')
    expect(normalizeOriginalUrl('http://site.com')).toBe('http://site.com')
  })

  it('only accepts http(s) URLs', () => {
    expect(isSafeHttpUrl('https://site.com')).toBe(true)
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false)
    expect(isSafeHttpUrl('not a url')).toBe(false)
  })

  it('parses a valid form', () => {
    expect(newLinkFormSchema.parse({ originalUrl: 'site.com', slug: ' my-link ' })).toEqual({
      originalUrl: 'https://site.com',
      slug: 'my-link',
    })
  })
})
