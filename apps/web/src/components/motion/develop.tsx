'use client';

import Image, { type ImageProps } from 'next/image';
import { useCallback, useState } from 'react';

type DevelopState = 'pending' | 'done';

/**
 * Photos "develop" as they load: soft blur and low saturation resolve into focus. Images that
 * are already decoded (cache) skip the effect. Styles live in globals.css (img[data-develop]).
 */
export function useDevelop() {
  const [state, setState] = useState<DevelopState>('pending');
  const attach = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setState('done');
  }, []);
  const settle = useCallback(() => setState('done'), []);
  return { attach, settle, state };
}

/** next/image with the develop entrance. */
export function DevelopImage({ onLoad, alt, ...props }: ImageProps) {
  const { attach, settle, state } = useDevelop();
  return (
    <Image
      {...props}
      alt={alt}
      ref={attach}
      data-develop={state}
      onLoad={(event) => {
        settle();
        onLoad?.(event);
      }}
      onError={settle}
    />
  );
}

/** Plain <img> (signed storage URLs) with the develop entrance. */
export function DevelopImg({ onLoad, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { attach, settle, state } = useDevelop();
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, sized by the caller
    <img
      {...props}
      alt={alt}
      ref={attach}
      data-develop={state}
      onLoad={(event) => {
        settle();
        onLoad?.(event);
      }}
      onError={settle}
    />
  );
}
