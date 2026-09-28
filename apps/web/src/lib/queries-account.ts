'use client';

import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { keys } from './queries';
import type { NotificationPage, NotificationPreferences, Profile, ProfilePatch, SlugAvailability } from './types-account';

export const accountKeys = {
  profile: ['account', 'profile'] as const,
  slug: (slug: string) => ['account', 'slug', slug] as const,
  notifications: ['notifications'] as const,
  list: (filter: 'all' | 'unread') => ['notifications', 'list', filter] as const,
  latest: ['notifications', 'latest'] as const,
  unread: ['notifications', 'unread'] as const,
};

export const useProfile = () => useQuery({ queryKey: accountKeys.profile, queryFn: () => api<Profile>('/v1/me/profile') });

/** Keeps the Settings form and the header (name, avatar) in step after a save. */
function useProfileSaved() {
  const client = useQueryClient();
  return (profile: Profile) => {
    client.setQueryData(accountKeys.profile, profile);
    void client.invalidateQueries({ queryKey: keys.me });
  };
}

export function useUpdateProfile() {
  const saved = useProfileSaved();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api<Profile>('/v1/me/profile', { method: 'PATCH', body: patch }),
    onSuccess: saved,
  });
}

/** Avatar or studio logo: upload replaces, remove clears. */
export function useProfileImage(kind: 'avatar' | 'logo') {
  const saved = useProfileSaved();
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('image', file);
      return api<Profile>(`/v1/me/${kind}`, { method: 'POST', body: form });
    },
    onSuccess: saved,
  });
  const remove = useMutation({
    mutationFn: () => api<Profile>(`/v1/me/${kind}`, { method: 'DELETE' }),
    onSuccess: saved,
  });
  return { upload, remove };
}

export const useSlugAvailability = (slug: string, enabled: boolean) =>
  useQuery({
    queryKey: accountKeys.slug(slug),
    queryFn: () => api<SlugAvailability>(`/v1/me/slug-available?slug=${encodeURIComponent(slug)}`),
    enabled,
    staleTime: 30_000,
  });

export function useUpdatePreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      api<NotificationPreferences>('/v1/me/notification-preferences', { method: 'PATCH', body: patch }),
    onSuccess: (notifications) => {
      client.setQueryData<Profile>(accountKeys.profile, (old) => (old ? { ...old, notifications } : old));
    },
  });
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string; logoutOtherDevices: boolean }) =>
      api<{ otherSessionsEnded: number }>('/v1/me/password', { body: input }),
  });

// ---------- notifications ----------

function notificationsUrl(params: { cursor?: string; unread?: boolean; limit?: number }) {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.unread) search.set('unread', '1');
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return `/v1/notifications${query ? `?${query}` : ''}`;
}

/** Notifications page: 20 per page, newest first. */
export const useNotifications = (filter: 'all' | 'unread') =>
  useInfiniteQuery({
    queryKey: accountKeys.list(filter),
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<NotificationPage>(notificationsUrl({ cursor: pageParam || undefined, unread: filter === 'unread' })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** The bell dropdown: the latest 8, fetched while it is open. */
export const useLatestNotifications = (enabled: boolean) =>
  useQuery({ queryKey: accountKeys.latest, queryFn: () => api<NotificationPage>(notificationsUrl({ limit: 8 })), enabled });

/** Unread count for the badge, refreshed every minute and when the tab regains focus. */
export const useUnreadCount = () =>
  useQuery({
    queryKey: accountKeys.unread,
    queryFn: async () => (await api<{ count: number }>('/v1/notifications/unread-count')).count,
    refetchInterval: 60_000,
  });

function useNotificationsChanged() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: accountKeys.notifications });
    void client.invalidateQueries({ queryKey: keys.me });
  };
}

export function useMarkRead() {
  const client = useQueryClient();
  const changed = useNotificationsChanged();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/notifications/${id}/read`, { method: 'POST' }),
    onMutate: (id) => {
      // Show it as read at once; the refetch afterwards settles the counts.
      const mark = (page: NotificationPage) => ({ ...page, items: page.items.map((n) => (n.id === id ? { ...n, read: true } : n)) });
      client.setQueryData<NotificationPage>(accountKeys.latest, (old) => (old ? mark(old) : old));
      client.setQueryData<InfiniteData<NotificationPage>>(accountKeys.list('all'), (old) => (old ? { ...old, pages: old.pages.map(mark) } : old));
    },
    onSettled: changed,
  });
}

export function useMarkAllRead() {
  const changed = useNotificationsChanged();
  return useMutation({
    mutationFn: () => api<{ updated: number }>('/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: changed,
  });
}
