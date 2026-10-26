import { CircleNotchIcon, DownloadSimpleIcon, LinkIcon, WarningIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useExportLinks, useLinks } from '../hooks/use-links'
import { downloadFile } from '../utils/browser'
import { LinkRow } from './link-row'
import { Button } from './ui/button'

function ListMessage({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border-gray-200 border-t pt-4 pb-6 text-center">
      {icon}
      <p className="text-xs text-gray-500 uppercase">{children}</p>
    </div>
  )
}

export function MyLinks() {
  const { data: links, isPending, isError, refetch, isRefetching } = useLinks()
  const exportLinks = useExportLinks()

  const hasLinks = Boolean(links && links.length > 0)

  async function handleExport() {
    try {
      const { reportUrl, fileName } = await exportLinks.mutateAsync()
      downloadFile(reportUrl, fileName)
      toast.success('Relatório gerado', { description: 'O download do CSV foi iniciado.' })
    } catch {
      toast.error('Erro ao gerar o CSV', {
        description: 'Não foi possível exportar os links agora. Tente novamente.',
      })
    }
  }

  return (
    <section
      aria-labelledby="my-links-title"
      className="flex min-w-0 flex-col gap-4 rounded-lg bg-gray-100 p-6 lg:flex-1 lg:gap-5 lg:p-8"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 id="my-links-title" className="text-lg font-bold text-gray-600">
          Meus links
        </h2>
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={!hasLinks || exportLinks.isPending}
          aria-busy={exportLinks.isPending}
        >
          {exportLinks.isPending ? (
            <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <DownloadSimpleIcon size={16} aria-hidden="true" />
          )}
          {exportLinks.isPending ? 'Gerando...' : 'Baixar CSV'}
        </Button>
      </header>

      {isPending ? (
        <ListMessage
          icon={
            <CircleNotchIcon size={32} className="animate-spin text-gray-400" aria-hidden="true" />
          }
        >
          <span role="status">Carregando links...</span>
        </ListMessage>
      ) : isError ? (
        <ListMessage icon={<WarningIcon size={32} className="text-danger" aria-hidden="true" />}>
          <span role="alert" className="flex flex-col items-center gap-3">
            Não foi possível carregar os links
            <Button variant="secondary" onClick={() => refetch()} disabled={isRefetching}>
              Tentar novamente
            </Button>
          </span>
        </ListMessage>
      ) : hasLinks ? (
        <ul className="flex flex-col gap-3 lg:gap-4" aria-label="Links cadastrados">
          {links?.map((link) => (
            <LinkRow key={link.id} link={link} />
          ))}
        </ul>
      ) : (
        <ListMessage icon={<LinkIcon size={32} className="text-gray-400" aria-hidden="true" />}>
          Ainda não existem links cadastrados
        </ListMessage>
      )}
    </section>
  )
}
