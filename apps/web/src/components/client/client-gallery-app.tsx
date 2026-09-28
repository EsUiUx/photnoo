'use client';

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Spinner } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { clientApi } from '@/lib/client-api';
import { ClientShell } from './client-shell';
import { GalleryView } from './gallery-view';
import { StatusScreen } from './status-screen';
import { UnlockScreen } from './unlock-screen';

/**
 * The client's side of a link (PRD C-01 to C-10). No account: the link token is in the URL and
 * a gallery-scoped HttpOnly cookie proves the password was entered. Because that cookie cannot
 * be read here, the page asks for the content and shows the password screen when it is refused.
 */
export function ClientGalleryApp({ token }: { token: string }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ClientGallery token={token} />
    </QueryClientProvider>
  );
}

export const clientKeys = {
  summary: (token: string) => ['g', token, 'summary'] as const,
  content: (token: string) => ['g', token, 'content'] as const,
};

function codeOf(error: unknown): string {
  return error instanceof ApiError ? error.code : 'network_error';
}

function ClientGallery({ token }: { token: string }) {
  const queries = useQueryClient();
  const summary = useQuery({ queryKey: clientKeys.summary(token), queryFn: () => clientApi.summary(token) });
  const open = summary.data?.state === 'open';
  const content = useQuery({
    queryKey: clientKeys.content(token),
    queryFn: () => clientApi.content(token),
    enabled: open,
    // Preview URLs are signed for 24 hours; the list only changes if the photographer edits it.
    staleTime: 30 * 60_000,
  });

  const refresh = () => {
    void queries.invalidateQueries({ queryKey: ['g', token] });
  };

  if (summary.isPending) return <ClientShell><Loading /></ClientShell>;
  if (summary.isError) {
    const code = codeOf(summary.error);
    return (
      <ClientShell token={code === 'link_invalid' ? undefined : token}>
        <StatusScreen kind={code === 'link_invalid' ? 'invalid' : 'error'} onRetry={() => void summary.refetch()} />
      </ClientShell>
    );
  }

  const gallery = summary.data;
  if (gallery.state !== 'open') {
    return (
      <ClientShell token={token}>
        <StatusScreen kind={gallery.state} gallery={gallery.name} photographer={gallery.photographer} />
      </ClientShell>
    );
  }

  if (content.isPending) return <ClientShell token={token}><Loading /></ClientShell>;
  if (content.isError) {
    const code = codeOf(content.error);
    if (code === 'password_required') {
      return (
        <ClientShell token={token}>
          <UnlockScreen token={token} summary={gallery} onUnlocked={() => void content.refetch()} />
        </ClientShell>
      );
    }
    const kind = code === 'gallery_closed' ? 'closed' : code === 'temporarily_unavailable' ? 'unavailable' : 'error';
    return (
      <ClientShell token={token}>
        <StatusScreen kind={kind} gallery={gallery.name} photographer={gallery.photographer} onRetry={refresh} />
      </ClientShell>
    );
  }

  return (
    <ClientShell token={token} variant="gallery">
      <GalleryView token={token} content={content.data} onGone={refresh} />
    </ClientShell>
  );
}

/** Spoken and visible loading state, so a slow 4G connection never looks like a blank page. */
function Loading() {
  const t = useTranslations('Client');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center" role="status">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface text-brand shadow-card">
        <Spinner size={22} />
      </span>
      <h1 className="text-base font-medium text-fg-secondary">{t('loading')}</h1>
    </div>
  );
}
