import type { ComponentProps } from 'react'
import { cn } from '../../utils/cn'

interface IconButtonProps extends ComponentProps<'button'> {
  'aria-label': string
}

export function IconButton({ className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded border border-transparent bg-gray-200 text-gray-600 transition-colors',
        'enabled:hover:border-blue-base',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-base',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
