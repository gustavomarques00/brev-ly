import { Logo } from '../components/logo'
import { MyLinks } from '../components/my-links'
import { NewLinkForm } from '../components/new-link-form'

export function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[604px] flex-col gap-6 px-3 py-8 lg:max-w-[1004px] lg:gap-8 lg:pt-[88px]">
      <header className="flex justify-center lg:justify-start">
        <h1 className="sr-only">brev.ly — encurtador de links</h1>
        <Logo />
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
        <NewLinkForm />
        <MyLinks />
      </div>
    </main>
  )
}
