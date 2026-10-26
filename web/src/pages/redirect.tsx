import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import logoIcon from '../assets/logo-icon.svg'
import { StatusCard } from '../components/status-card'
import { Button } from '../components/ui/button'
import { ApiError } from '../http/client'
import { getLinkBySlug, registerLinkAccess } from '../http/links'
import { isSafeHttpUrl, isValidSlug } from '../schemas/link'
import { redirectTo } from '../utils/browser'
import { NotFoundPage } from './not-found'

const isClientError = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500

export function RedirectPage() {
  const { slug } = useParams()

  if (!isValidSlug(slug)) return <NotFoundPage />

  return <Redirecting key={slug} slug={slug} />
}

function Redirecting({ slug }: { slug: string }) {
  const {
    data: link,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['links', 'by-slug', slug.toLowerCase()],
    queryFn: ({ signal }) => getLinkBySlug(slug, signal),
    retry: (failureCount, queryError) => !isClientError(queryError) && failureCount < 2,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })

  // One access per page visit: the ref survives StrictMode's effect replay and
  // re-renders, so the counter cannot be incremented twice by this component.
  const redirectStartedRef = useRef(false)

  useEffect(() => {
    if (!link || redirectStartedRef.current || !isSafeHttpUrl(link.originalUrl)) return
    redirectStartedRef.current = true

    registerLinkAccess(link.id)
      .catch(() => undefined)
      .finally(() => redirectTo(link.originalUrl))
  }, [link])

  if ((error && isClientError(error)) || (link && !isSafeHttpUrl(link.originalUrl))) {
    return <NotFoundPage />
  }

  const media = <img src={logoIcon} alt="" width={48} height={48} className="size-12" />

  if (error) {
    return (
      <StatusCard title="Algo deu errado" media={media}>
        <p role="alert">Não foi possível abrir o link agora.</p>
        <Button
          variant="secondary"
          className="mt-3 self-center"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          Tentar novamente
        </Button>
      </StatusCard>
    )
  }

  return (
    <StatusCard title="Redirecionando..." media={media}>
      <p role="status">O link será aberto automaticamente em alguns instantes.</p>
      <p>
        Não foi redirecionado?{' '}
        {link ? (
          <a href={link.originalUrl} className="text-blue-base underline">
            Acesse aqui
          </a>
        ) : (
          <span className="text-blue-base underline opacity-60" aria-disabled="true">
            Acesse aqui
          </span>
        )}
      </p>
    </StatusCard>
  )
}
