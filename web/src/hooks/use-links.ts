import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createLink, deleteLink, exportLinksReport, type Link, listLinks } from '../http/links'

export const linksQueryKey = ['links'] as const

export function useLinks() {
  return useQuery({
    queryKey: linksQueryKey,
    queryFn: ({ signal }) => listLinks(signal),
  })
}

export function useCreateLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createLink,
    onSuccess: (link) => {
      queryClient.setQueryData<Link[]>(linksQueryKey, (links = []) => [link, ...links])
    },
  })
}

export function useDeleteLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteLink,
    onSuccess: (_, id) => {
      queryClient.setQueryData<Link[]>(linksQueryKey, (links = []) =>
        links.filter((link) => link.id !== id),
      )
    },
  })
}

export function useExportLinks() {
  return useMutation({ mutationFn: exportLinksReport })
}
