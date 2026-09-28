'use client';

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateGalleryInput, UpdateGalleryInput } from '@photnoo/shared';
import { api } from './api';
import type { BillingOverview, BillingPayment, Dashboard, Gallery, GalleryActivity, GalleryDetail, GalleryListItem, Me } from './types';
import type { GalleryFilters } from './types-galleries';

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  galleries: (filters: GalleryFilters) => ['galleries', filters] as const,
  gallery: (id: string) => ['gallery', id] as const,
  activity: (id: string) => ['gallery', id, 'activity'] as const,
  billing: ['billing'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/v1/me') });

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>('/v1/dashboard') });

/** Cursor-paged gallery list (20 per page by default); `data.pages` holds each loaded page. */
export const useGalleries = (filters: GalleryFilters = {}) =>
  useInfiniteQuery({
    queryKey: keys.galleries(filters),
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '' && value !== null) params.set(key, String(value));
      }
      if (pageParam) params.set('cursor', pageParam);
      const query = params.toString();
      return api<{ items: GalleryListItem[]; nextCursor: string | null }>(`/v1/galleries${query ? `?${query}` : ''}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

/** Polls every 3 s while any file is still uploading or being processed. */
export const useGallery = (id: string) =>
  useQuery({
    queryKey: keys.gallery(id),
    queryFn: () => api<GalleryDetail>(`/v1/galleries/${id}`),
    refetchInterval: (query) =>
      query.state.data?.files.some((f) => f.status === 'processing' || f.status === 'uploading') ? 3000 : false,
  });

export const useGalleryActivity = (id: string, enabled: boolean) =>
  useQuery({ queryKey: keys.activity(id), queryFn: () => api<GalleryActivity>(`/v1/galleries/${id}/activity`), enabled });

function useInvalidate() {
  const client = useQueryClient();
  return (galleryId?: string) => {
    void client.invalidateQueries({ queryKey: ['galleries'] });
    void client.invalidateQueries({ queryKey: keys.dashboard });
    void client.invalidateQueries({ queryKey: keys.me });
    if (galleryId) void client.invalidateQueries({ queryKey: keys.gallery(galleryId) });
  };
}

export function useCreateGallery() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateGalleryInput) => api<Gallery>('/v1/galleries', { body: input }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateGallery(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: UpdateGalleryInput) => api<Gallery>(`/v1/galleries/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteGallery() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/galleries/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateFolder(galleryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (name: string) => api(`/v1/galleries/${galleryId}/folders`, { body: { name } }),
    onSuccess: () => invalidate(galleryId),
  });
}

export function useDeleteFolder(galleryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (folderId: string) => api(`/v1/folders/${folderId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(galleryId),
  });
}

export function useDeleteFile(galleryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (fileId: string) => api(`/v1/files/${fileId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(galleryId),
  });
}

export function useActivate(galleryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (days?: number) =>
      api<{ link: string; password: string; expiresAt: string }>(`/v1/galleries/${galleryId}/activate`, { method: 'POST', body: { days } }),
    onSuccess: () => invalidate(galleryId),
  });
}

export function useRegeneratePassword(galleryId: string) {
  return useMutation({
    mutationFn: () => api<{ password: string }>(`/v1/galleries/${galleryId}/password`, { method: 'POST' }),
  });
}

export function useCloseGallery(galleryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api(`/v1/galleries/${galleryId}/close`, { method: 'POST' }),
    onSuccess: () => invalidate(galleryId),
  });
}

export const fetchLink = (galleryId: string) => api<{ link: string; expiresAt: string }>(`/v1/galleries/${galleryId}/link`);

// ---------- Billing ----------

export const useBilling = () => useQuery({ queryKey: keys.billing, queryFn: () => api<BillingOverview>('/v1/billing') });

function useInvalidateBilling() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.billing });
    void client.invalidateQueries({ queryKey: keys.me });
  };
}

export function useCheckout() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (planId: string) => api<BillingPayment>('/v1/billing/checkout', { body: { planId } }),
    onSettled: invalidate,
  });
}

export function useNextPlan() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (planId: string | null) => api('/v1/billing/next-plan', { method: 'PUT', body: { planId } }),
    onSettled: invalidate,
  });
}

export function useSubmitProof(paymentId: string) {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (input: { file: File; method: string; declaredAmountEgp: number }) => {
      const form = new FormData();
      form.set('method', input.method);
      form.set('declaredAmountEgp', String(input.declaredAmountEgp));
      form.set('proof', input.file);
      return api<BillingPayment>(`/v1/billing/payments/${paymentId}/proof`, { method: 'POST', body: form });
    },
    onSuccess: invalidate,
  });
}

export function useCancelPayment() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (paymentId: string) => api(`/v1/billing/payments/${paymentId}/cancel`, { method: 'POST' }),
    onSettled: invalidate,
  });
}

/** Signed, 5-minute links; fetched when clicked so they are always fresh. */
export const fetchInvoiceUrl = (invoiceId: string) => api<{ url: string }>(`/v1/billing/invoices/${invoiceId}/pdf`);
export const fetchProofUrl = (paymentId: string) => api<{ url: string }>(`/v1/billing/payments/${paymentId}/proof`);
