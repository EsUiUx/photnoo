'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CommerceSettingsInput,
  CreatePrintItemInput,
  CreateProductInput,
  UpdateOrderInput,
  UpdatePrintItemInput,
  UpdateProductInput,
} from '@photnoo/shared';
import { api } from './api';
import type {
  CommerceSettings,
  Order,
  OrdersFilter,
  OrdersPage,
  PrintItem,
  PrintOffer,
  PrintOrderReceipt,
  PrintSettings,
  PrintStats,
  Product,
  PublicOrderReceipt,
  StoreStats,
} from './types-commerce';

export const commerceKeys = {
  settings: ['commerce', 'settings'] as const,
  storeStats: ['commerce', 'store-stats'] as const,
  products: ['commerce', 'products'] as const,
  printSettings: ['commerce', 'print-settings'] as const,
  printStats: ['commerce', 'print-stats'] as const,
  printItems: ['commerce', 'print-items'] as const,
  orders: (filter: OrdersFilter) => ['commerce', 'orders', filter] as const,
  order: (id: string) => ['commerce', 'order', id] as const,
};

function useInvalidateCommerce() {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: ['commerce'] });
}

// ---------- settings ----------

export const useCommerceSettings = () =>
  useQuery({ queryKey: commerceKeys.settings, queryFn: () => api<CommerceSettings>('/v1/store/settings') });

export function useUpdateCommerceSettings() {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: (input: CommerceSettingsInput) => api<CommerceSettings>('/v1/store/settings', { method: 'PATCH', body: input }),
    onSettled: invalidate,
  });
}

// ---------- store ----------

export const useStoreStats = () => useQuery({ queryKey: commerceKeys.storeStats, queryFn: () => api<StoreStats>('/v1/store/stats') });

export const useProducts = () =>
  useQuery({ queryKey: commerceKeys.products, queryFn: () => api<{ items: Product[] }>('/v1/store/products'), select: (d) => d.items });

/** Creates or updates the product, then applies the picture change (upload or removal). */
export function useSaveProduct() {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: async (input: { id?: string; data: CreateProductInput | UpdateProductInput; image?: File | null }) => {
      let product = input.id
        ? await api<Product>(`/v1/store/products/${input.id}`, { method: 'PATCH', body: input.data })
        : await api<Product>('/v1/store/products', { body: input.data });
      if (input.image) {
        const form = new FormData();
        form.set('image', input.image);
        product = await api<Product>(`/v1/store/products/${product.id}/image`, { method: 'POST', body: form });
      } else if (input.image === null && product.imageUrl) {
        product = await api<Product>(`/v1/store/products/${product.id}/image`, { method: 'DELETE' });
      }
      return product;
    },
    onSettled: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: (id: string) => api<{ archived: boolean }>(`/v1/store/products/${id}`, { method: 'DELETE' }),
    onSettled: invalidate,
  });
}

// ---------- prints ----------

export const usePrintSettings = () =>
  useQuery({ queryKey: commerceKeys.printSettings, queryFn: () => api<PrintSettings>('/v1/prints/settings') });

export function useSetPrintsEnabled() {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: (printsEnabled: boolean) => api<PrintSettings>('/v1/prints/settings', { method: 'PATCH', body: { printsEnabled } }),
    onSettled: invalidate,
  });
}

/** Per-gallery override, for the gallery screens. */
export const useGalleryPrints = (galleryId: string) =>
  useQuery({
    queryKey: ['commerce', 'gallery-prints', galleryId],
    queryFn: () => api<{ galleryId: string; printsEnabled: boolean; offered: boolean }>(`/v1/prints/galleries/${galleryId}`),
  });

export function useSetGalleryPrints(galleryId: string) {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: (printsEnabled: boolean) =>
      api<{ galleryId: string; printsEnabled: boolean; offered: boolean }>(`/v1/prints/galleries/${galleryId}`, {
        method: 'PATCH',
        body: { printsEnabled },
      }),
    onSettled: invalidate,
  });
}

export const usePrintStats = () => useQuery({ queryKey: commerceKeys.printStats, queryFn: () => api<PrintStats>('/v1/prints/stats') });

export const usePrintItems = () =>
  useQuery({ queryKey: commerceKeys.printItems, queryFn: () => api<{ items: PrintItem[] }>('/v1/prints/items'), select: (d) => d.items });

export function useSavePrintItem() {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: async (input: { id?: string; data: CreatePrintItemInput | UpdatePrintItemInput; image?: File | null }) => {
      let item = input.id
        ? await api<PrintItem>(`/v1/prints/items/${input.id}`, { method: 'PATCH', body: input.data })
        : await api<PrintItem>('/v1/prints/items', { body: input.data });
      if (input.image) {
        const form = new FormData();
        form.set('image', input.image);
        item = await api<PrintItem>(`/v1/prints/items/${item.id}/image`, { method: 'POST', body: form });
      } else if (input.image === null && item.imageUrl) {
        item = await api<PrintItem>(`/v1/prints/items/${item.id}/image`, { method: 'DELETE' });
      }
      return item;
    },
    onSettled: invalidate,
  });
}

export function useDeletePrintItem() {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: (id: string) => api<{ archived: boolean }>(`/v1/prints/items/${id}`, { method: 'DELETE' }),
    onSettled: invalidate,
  });
}

// ---------- orders ----------

export const useOrders = (filter: OrdersFilter) =>
  useQuery({
    queryKey: commerceKeys.orders(filter),
    queryFn: () => {
      const params = new URLSearchParams({ kind: filter.kind });
      if (filter.q) params.set('q', filter.q);
      if (filter.from) params.set('from', filter.from);
      if (filter.to) params.set('to', filter.to);
      if (filter.page && filter.page > 1) params.set('page', String(filter.page));
      return api<OrdersPage>(`/v1/orders?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

export const useOrder = (id: string | null) =>
  useQuery({ queryKey: commerceKeys.order(id ?? ''), queryFn: () => api<Order>(`/v1/orders/${id}`), enabled: Boolean(id) });

export function useUpdateOrder() {
  const client = useQueryClient();
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: (input: { id: string; data: UpdateOrderInput }) => api<Order>(`/v1/orders/${input.id}`, { method: 'PATCH', body: input.data }),
    onSuccess: (order) => client.setQueryData(commerceKeys.order(order.id), order),
    onSettled: invalidate,
  });
}


// ---------- public and client (no photographer session) ----------

export const shopApi = {
  order: (slug: string, input: { name: string; phone: string; email?: string; note?: string; items: Array<{ productId: string; quantity: number }> }) =>
    api<PublicOrderReceipt>(`/v1/public/p/${encodeURIComponent(slug)}/orders`, { body: input, retry: false }),
};

const galleryBase = (token: string) => `/v1/g/${encodeURIComponent(token)}/prints`;

export const clientPrintsApi = {
  offer: (token: string) => api<PrintOffer>(galleryBase(token), { retry: false }),
  order: (token: string, input: { name: string; phone: string; note?: string; printItemId: string; fileId: string; quantity: number }) =>
    api<PrintOrderReceipt>(`${galleryBase(token)}/orders`, { body: input, retry: false }),
};
