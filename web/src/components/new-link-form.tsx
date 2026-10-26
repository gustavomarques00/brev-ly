import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useCreateLink } from '../hooks/use-links'
import { ApiError } from '../http/client'
import { type NewLinkFormInput, type NewLinkFormOutput, newLinkFormSchema } from '../schemas/link'
import { displayShortUrl, shortUrlPrefix } from '../utils/links'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function NewLinkForm() {
  const createLink = useCreateLink()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NewLinkFormInput, unknown, NewLinkFormOutput>({
    resolver: zodResolver(newLinkFormSchema),
    defaultValues: { originalUrl: '', slug: '' },
  })

  async function onSubmit(data: NewLinkFormOutput) {
    try {
      const link = await createLink.mutateAsync(data)
      reset()
      toast.success('Link criado com sucesso', {
        description: `${displayShortUrl(link.slug)} já está disponível.`,
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError('slug', { message: 'Essa URL encurtada já existe.' }, { shouldFocus: true })
        return
      }
      if (error instanceof ApiError && error.status === 400) {
        toast.error('Dados inválidos', { description: 'Revise a URL original e a URL encurtada.' })
        return
      }
      toast.error('Erro ao criar o link', {
        description: 'Não foi possível salvar agora. Tente novamente em instantes.',
      })
    }
  }

  const isSaving = createLink.isPending

  return (
    <section
      aria-labelledby="new-link-title"
      className="flex flex-col gap-5 rounded-lg bg-gray-100 p-6 lg:w-[380px] lg:shrink-0 lg:gap-6 lg:p-8"
    >
      <h2 id="new-link-title" className="text-lg font-bold text-gray-600">
        Novo link
      </h2>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5 lg:gap-6"
        aria-busy={isSaving}
      >
        <fieldset disabled={isSaving} className="flex flex-col gap-4">
          <Input
            label="Link original"
            placeholder="www.exemplo.com.br"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            error={errors.originalUrl?.message}
            {...register('originalUrl')}
          />
          <Input
            label="Link encurtado"
            prefix={shortUrlPrefix}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={50}
            error={errors.slug?.message}
            {...register('slug')}
          />
        </fieldset>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar link'}
        </Button>
      </form>
    </section>
  )
}
