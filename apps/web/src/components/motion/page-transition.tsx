import { ViewTransition } from 'react';

/**
 * Route change: the old page leaves fast, the new one rises in with a slight focus pull.
 * Used from template.tsx files, which remount on every navigation so enter/exit fire;
 * the surrounding layout (sidebar, header) stays still. CSS: `.page` in globals.css.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
