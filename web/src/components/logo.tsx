import { Link } from 'react-router'
import logoMark from '../assets/logo-mark.svg'

export function Logo() {
  return (
    <Link
      to="/"
      aria-label="brev.ly — página inicial"
      className="inline-flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-base"
    >
      <img src={logoMark} alt="" width={26.67} height={22.67} className="h-[22.67px] w-[26.67px]" />
      <span className="font-logo text-[18.667px] leading-none font-bold text-blue-base">
        brev.ly
      </span>
    </Link>
  )
}
