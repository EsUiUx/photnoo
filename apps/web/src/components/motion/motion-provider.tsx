'use client';

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';

/**
 * Motion for React, loaded lean: `m.*` components with the DOM animation feature set, and the
 * visitor's reduced-motion setting honoured everywhere (transforms off, opacity kept).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
