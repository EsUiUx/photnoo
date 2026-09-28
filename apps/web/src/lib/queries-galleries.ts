'use client';

import type { ClientInput, UpdateClientInput } from '@photnoo/shared';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { keys } from './queries';
import type { Folder, Gallery } from './types';
import type { Client, ClientDetail, ClientListItem, ClientOrdersPage } from './types-galleries';

export const clientKeys = {
  all: ['clients'] as const,
  list: (q: string) => ['clients', 'list', q] as const,
  detail: (id: string) => ['clients', 'detail', id] as const,
  orders: (id: string, page: number) => ['clients', 'detail', id, 'orders', page] as const,
};

// ---------- Clients ----------

/** Cursor-paged client list, newest first. */
export const useClients = (q: string) =>
  useInfiniteQuery({
    queryKey: clientKeys.list(q),
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      const query = params.toString();
      return api<{ items: ClientListItem[]; nextCursor: string | null }>(`/v1/clients${query ? `?${query}` : ''}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

export const useClient = (id: string | null) =>
  useQuery({ queryKey: clientKeys.detail(id ?? ''), queryFn: () => api<ClientDetail>(`/v1/clients/${id}`), enabled: Boolean(id) });

export const useClientOrders = (id: string | null, page: number) =>
  useQuery({
    queryKey: clientKeys.orders(id ?? '', page),
    queryFn: () => api<ClientOrdersPage>(`/v1/clients/${id}/orders?page=${page}`),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });

function useInvalidateClients() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: clientKeys.all });
    void client.invalidateQueries({ queryKey: keys.dashboard });
    void client.invalidateQueries({ queryKey: ['galleries'] });
    void client.invalidateQueries({ queryKey: ['gallery'] });
  };
}

export function useCreateClient() {
  const invalidate = useInvalidateClients();
  return useMutation({ mutationFn: (input: ClientInput) => api<Client>('/v1/clients', { body: input }), onSuccess: invalidate });
}

export function useUpdateClient(id: string) {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (input: UpdateClientInput) => api<Client>(`/v1/clients/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteClient() {
  const invalidate = useInvalidateClients();
  return useMutation({ mutationFn: (id: string) => api(`/v1/clients/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

// ---------- Gallery workspace: folders, files, cover, expiry ----------

function useInvalidateGallery(galleryId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.gallery(galleryId) });
    void client.invalidateQueries({ queryKey: ['galleries'] });
    void client.invalidateQueries({ queryKey: keys.dashboard });
  };
}

export function useUpdateFolder(galleryId: string) {
  const invalidate = useInvalidateGallery(galleryId);
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; position?: number }) =>
      api<Folder>(`/v1/folders/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useReorderFolders(galleryId: string) {
  const invalidate = useInvalidateGallery(galleryId);
  return useMutation({
    mutationFn: (folderIds: string[]) => api<{ folders: Folder[] }>(`/v1/galleries/${galleryId}/folders/reorder`, { body: { folderIds } }),
    onSettled: invalidate,
  });
}

export function useMoveFiles(galleryId: string) {
  const invalidate = useInvalidateGallery(galleryId);
  return useMutation({
    mutationFn: (input: { fileIds: string[]; folderId: string | null }) =>
      input.fileIds.length === 1
        ? api(`/v1/files/${input.fileIds[0]}`, { method: 'PATCH', body: { folderId: input.folderId } })
        : api(`/v1/galleries/${galleryId}/files/move`, { body: input }),
    onSuccess: invalidate,
  });
}

export function useSetCover(galleryId: string) {
  const invalidate = useInvalidateGallery(galleryId);
  return useMutation({
    mutationFn: (fileId: string) => api<Gallery>(`/v1/galleries/${galleryId}/cover`, { method: 'PUT', body: { fileId } }),
    onSuccess: invalidate,
  });
}

export function useExtendGallery(galleryId: string) {
  const invalidate = useInvalidateGallery(galleryId);
  return useMutation({
    mutationFn: (days: number) => api<{ expiresAt: string }>(`/v1/galleries/${galleryId}/extend`, { body: { days } }),
    onSuccess: invalidate,
  });
}
