import { WarningIcon } from '@phosphor-icons/react'
import { type ComponentProps, useId } from 'react'
import { cn } from '../../utils/cn'

interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  label: string
  error?: string
  /** Fixed text rendered before the value, e.g. "brev.ly/". */
  prefix?: string
}

export function Input({ label, error, prefix, id, className, placeholder, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const hasError = Boolean(error)

  return (
    <div className={cn('group flex flex-col gap-2', className)} data-error={hasError}>
      <label
        htmlFor={inputId}
        className={cn(
          'text-xs text-gray-500 uppercase',
          'group-focus-within:font-bold group-focus-within:text-blue-base',
          'group-data-[error=true]:font-bold group-data-[error=true]:text-danger',
        )}
      >
        {label}
      </label>

      <div
        className={cn(
          'flex h-12 items-center rounded-lg border border-gray-300 px-4 transition-colors',
          'group-focus-within:border-blue-base group-focus-within:ring-[0.5px] group-focus-within:ring-blue-base group-focus-within:ring-inset',
          'group-data-[error=true]:border-danger group-data-[error=true]:ring-[0.5px] group-data-[error=true]:ring-danger group-data-[error=true]:ring-inset',
        )}
      >
        <input
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          // A blank placeholder lets the prefix react to :placeholder-shown.
          placeholder={placeholder ?? (prefix ? ' ' : undefined)}
          className={cn(
            'peer h-full min-w-0 flex-1 bg-transparent text-md text-gray-600 caret-blue-base outline-none',
            'placeholder:text-gray-400',
          )}
          {...props}
        />
        {prefix && (
          <span
            aria-hidden="true"
            className="order-first shrink-0 text-md text-gray-600 peer-placeholder-shown:text-gray-400"
          >
            {prefix}
          </span>
        )}
      </div>

      {hasError && (
        <p id={errorId} role="alert" className="flex items-center gap-2 text-sm text-gray-500">
          <WarningIcon size={16} className="shrink-0 text-danger" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
