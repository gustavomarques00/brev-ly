import { CheckIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDeleteLink } from '../hooks/use-links'
import type { Link } from '../http/links'
import {
  buildShortUrl,
  displayOriginalUrl,
  displayShortUrl,
  formatAccessCount,
} from '../utils/links'
import { IconButton } from './ui/icon-button'

const COPIED_FEEDBACK_MS = 2000

export function LinkRow({ link }: { link: Link }) {
  const deleteLink = useDeleteLink()
  const [copied, setCopied] = useState(false)
  const shortLabel = displayShortUrl(link.slug)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildShortUrl(link.slug))
      setCopied(true)
      toast.info('Link copiado com sucesso', {
        description: `O link ${shortLabel} foi copiado para a área de transferência.`,
      })
    } catch {
      toast.error('Não foi possível copiar o link', {
        description: 'Copie manualmente ou verifique as permissões do navegador.',
      })
    }
  }

  async function handleDelete() {
    if (deleteLink.isPending) return
    if (!window.confirm(`Você realmente quer apagar o link ${shortLabel}?`)) return

    try {
      await deleteLink.mutateAsync(link.id)
      toast.success('Link removido', { description: `${shortLabel} foi apagado.` })
    } catch {
      toast.error('Erro ao remover o link', { description: 'Tente novamente em instantes.' })
    }
  }

  return (
    <li
      aria-busy={deleteLink.isPending}
      className="flex items-center gap-4 border-gray-200 border-t pt-3 aria-busy:opacity-50 lg:gap-5 lg:pt-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <a
          href={buildShortUrl(link.slug)}
          target="_blank"
          rel="noreferrer"
          className="truncate rounded text-md font-semibold text-blue-base hover:underline focus-visible:outline-2 focus-visible:outline-blue-base"
        >
          {shortLabel}
        </a>
        <span className="truncate text-sm text-gray-500" title={link.originalUrl}>
          {displayOriginalUrl(link.originalUrl)}
        </span>
      </div>

      <span className="shrink-0 text-right text-sm whitespace-nowrap text-gray-500">
        {formatAccessCount(link.accessCount)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          aria-label={copied ? `Link ${shortLabel} copiado` : `Copiar link ${shortLabel}`}
          onClick={handleCopy}
          disabled={deleteLink.isPending}
        >
          {copied ? (
            <CheckIcon size={16} aria-hidden="true" />
          ) : (
            <CopyIcon size={16} aria-hidden="true" />
          )}
        </IconButton>
        <IconButton
          aria-label={`Apagar link ${shortLabel}`}
          onClick={handleDelete}
          disabled={deleteLink.isPending}
        >
          <TrashIcon size={16} aria-hidden="true" />
        </IconButton>
      </div>
    </li>
  )
}
