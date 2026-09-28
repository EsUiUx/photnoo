'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up to its value the first time it is seen, then follows later changes
 * with a short tween. Screen readers, no-JS pages and reduced motion always get the final value.
 */
export function CountUp({ value, format, duration = 0.9 }: { value: number; format: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const start = from.current;
    from.current = value;
    const controls = animate(start, value, {
      duration: start === 0 ? duration : 0.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => setShown(Number.isInteger(value) ? Math.round(n) : n),
    });
    return () => controls.stop();
  }, [inView, value, reduce, duration]);

  const display = reduce || shown === null ? value : shown;
  return (
    <span ref={ref}>
      <span aria-hidden>{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
