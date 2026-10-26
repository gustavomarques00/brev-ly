import type { ReactNode } from 'react'

interface StatusCardProps {
  media: ReactNode
  title: string
  children: ReactNode
}

export function StatusCard({ media, title, children }: StatusCardProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-3 py-8">
      <section className="flex w-full max-w-[580px] flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center lg:px-12 lg:py-16">
        {media}
        <h1 className="text-xl font-bold text-gray-600">{title}</h1>
        <div className="flex flex-col gap-1 text-md font-semibold text-gray-500">{children}</div>
      </section>
    </main>
  )
}
