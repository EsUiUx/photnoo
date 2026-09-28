'use client';

import { useEffect, useRef } from 'react';

type RevealVariant = 'rise' | 'develop' | 'clip';

/** Shared observer: one IntersectionObserver for every reveal on the page. */
let observer: IntersectionObserver | null = null;
function observe(el: Element) {
  if (typeof IntersectionObserver === 'undefined') {
    el.setAttribute('data-revealed', '');
    return () => undefined;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-revealed', '');
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  );
  observer.observe(el);
  return () => observer?.unobserve(el);
}

function useRevealRef<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el);
  }, []);
  return ref;
}

type RevealProps = {
  children: React.ReactNode;
  /** rise: fade and settle up. develop: blur resolves to focus (photos). clip: a mask opens upward. */
  variant?: RevealVariant;
  /** Extra delay in ms, for pairing a heading with what follows it. */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'figure' | 'header' | 'span';
  id?: string;
};

/**
 * One-time reveal when the element scrolls into view. Content is visible without JavaScript and
 * under reduced motion only fades (see the motion block in globals.css).
 */
export function Reveal({ children, variant = 'rise', delay, className, as: Tag = 'div', id }: RevealProps) {
  const ref = useRevealRef<HTMLDivElement>();
  return (
    <Tag
      ref={ref as React.Ref<never>}
      id={id}
      data-reveal={variant}
      className={className}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

type StaggerProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol' | 'section';
  id?: string;
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
} & { [dataAttribute: `data-${string}`]: string | undefined };

/**
 * A list that arrives as a list: children marked with `staggerItem(i)` settle in one after
 * another (45 ms apart, capped at the 8th) the first time the list is seen.
 */
export function Stagger({ children, className, as: Tag = 'div', ...rest }: StaggerProps) {
  const ref = useRevealRef<HTMLDivElement>();
  return (
    <Tag ref={ref as React.Ref<never>} data-stagger="" className={className} {...rest}>
      {children}
    </Tag>
  );
}

