import { Link } from 'react-router'
import notFoundArt from '../assets/not-found.svg'
import { StatusCard } from '../components/status-card'

export function NotFoundPage() {
  return (
    <StatusCard
      title="Link não encontrado"
      media={
        <div className="relative h-[72px] w-[164px] shrink-0 lg:h-[85px] lg:w-[194px]">
          <div className="absolute inset-[12.87%_4.39%_17.18%_4.35%]">
            <img src={notFoundArt} alt="404" width={177} height={59} className="block size-full" />
          </div>
        </div>
      }
    >
      <p>
        O link que você está tentando acessar não existe, foi removido ou é uma URL inválida. Saiba
        mais em{' '}
        <Link to="/" className="text-blue-base underline">
          brev.ly
        </Link>
        .
      </p>
    </StatusCard>
  )
}
