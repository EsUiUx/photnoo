'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useState } from 'react';
import { ApiError } from '@/lib/api';
import { keys } from '@/lib/queries';
import { Uploader } from '@/lib/uploader';

const UploaderContext = createContext<Uploader | null>(null);

/** One uploader for the whole app, so uploads keep running while the photographer navigates. */
function UploaderProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [uploader] = useState(
    () =>
      new Uploader({
        onFileDone: (galleryId) => {
          void client.invalidateQueries({ queryKey: keys.gallery(galleryId) });
          void client.invalidateQueries({ queryKey: keys.me });
        },
      }),
  );
  return <UploaderContext.Provider value={uploader}>{children}</UploaderContext.Provider>;
}

export function useUploader(): Uploader {
  const uploader = useContext(UploaderContext);
  if (!uploader) throw new Error('useUploader must be used inside AppProviders');
  return uploader;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            // Client errors (401, 404) will not fix themselves on retry.
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <UploaderProvider>{children}</UploaderProvider>
    </QueryClientProvider>
  );
}
