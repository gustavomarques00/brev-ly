import type { ComponentProps } from 'react'
import { cn } from '../../utils/cn'

const variants = {
  primary:
    'h-12 w-full gap-2 rounded-lg bg-blue-base px-5 text-md font-semibold text-white enabled:hover:bg-blue-dark',
  secondary:
    'h-8 gap-1.5 rounded border border-transparent bg-gray-200 px-2 text-sm font-semibold text-gray-500 enabled:hover:border-blue-base [&_svg]:text-gray-600',
} as const

interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variants
}

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-base',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
