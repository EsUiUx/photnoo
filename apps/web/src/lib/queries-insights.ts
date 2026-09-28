'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdatePortfolioItemInput } from '@photnoo/shared';
import { api } from './api';
import type {
  AnalyticsOverview,
  AnalyticsRange,
  AnalyticsTimeseries,
  Portfolio,
  PortfolioItem,
  TopClient,
  TopGallery,
} from './types-insights';

export const insightKeys = {
  portfolio: ['portfolio'] as const,
  analytics: (part: string, range: AnalyticsRange) => ['analytics', part, range] as const,
};

// ---------- Portfolio ----------

/** Signed image links last an hour; refetch well before that. */
export const usePortfolio = () =>
  useQuery({ queryKey: insightKeys.portfolio, queryFn: () => api<Portfolio>('/v1/portfolio'), staleTime: 60_000, refetchInterval: 45 * 60_000 });

/** One image per request; the caller runs files one after another. */
export function useUploadPortfolioItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; category?: string }) => {
      const form = new FormData();
      if (input.category) form.set('category', input.category);
      form.set('image', input.file);
      return api<PortfolioItem>('/v1/portfolio/items', { method: 'POST', body: form });
    },
    onSuccess: (item) =>
      client.setQueryData<Portfolio>(insightKeys.portfolio, (old) => (old ? { ...old, items: [...old.items, item] } : old)),
  });
}

export function useUpdatePortfolioItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdatePortfolioItemInput & { id: string }) =>
      api<PortfolioItem>(`/v1/portfolio/items/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (item) =>
      client.setQueryData<Portfolio>(insightKeys.portfolio, (old) =>
        old ? { ...old, items: old.items.map((i) => (i.id === item.id ? item : i)) } : old,
      ),
  });
}

export function useDeletePortfolioItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/portfolio/items/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) =>
      client.setQueryData<Portfolio>(insightKeys.portfolio, (old) => (old ? { ...old, items: old.items.filter((i) => i.id !== id) } : old)),
  });
}

/** Optimistic: the grid moves at once and rolls back if the server refuses. */
export function useReorderPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api<Portfolio>('/v1/portfolio/reorder', { body: { ids } }),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: insightKeys.portfolio });
      const previous = client.getQueryData<Portfolio>(insightKeys.portfolio);
      if (previous) {
        const byId = new Map(previous.items.map((i) => [i.id, i]));
        const moved = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
        const rest = previous.items.filter((i) => !ids.includes(i.id));
        client.setQueryData<Portfolio>(insightKeys.portfolio, { ...previous, items: [...moved, ...rest] });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(insightKeys.portfolio, context.previous);
    },
    onSuccess: (portfolio) => client.setQueryData(insightKeys.portfolio, portfolio),
  });
}

export function usePublishPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (published: boolean) =>
      api<{ published: boolean; slug: string | null }>('/v1/portfolio/settings', { method: 'PATCH', body: { published } }),
    onSuccess: (result) =>
      client.setQueryData<Portfolio>(insightKeys.portfolio, (old) => (old ? { ...old, ...result } : old)),
  });
}

// ---------- Analytics ----------

function useAnalytics<T>(part: string, range: AnalyticsRange) {
  return useQuery({
    queryKey: insightKeys.analytics(part, range),
    queryFn: () => api<T>(`/v1/analytics/${part}?range=${range}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export const useAnalyticsOverview = (range: AnalyticsRange) => useAnalytics<AnalyticsOverview>('overview', range);
export const useAnalyticsTimeseries = (range: AnalyticsRange) => useAnalytics<AnalyticsTimeseries>('timeseries', range);
export const useTopClients = (range: AnalyticsRange) => useAnalytics<{ range: AnalyticsRange; items: TopClient[] }>('top-clients', range);
export const useTopGalleries = (range: AnalyticsRange) => useAnalytics<{ range: AnalyticsRange; items: TopGallery[] }>('top-galleries', range);
