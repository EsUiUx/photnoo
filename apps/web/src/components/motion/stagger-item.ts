/**
 * Props for a direct child of <Stagger> (reveal.tsx). A plain module, not a client one, so
 * server components can call it too.
 */
export function staggerItem(index: number) {
  return { 'data-stagger-item': '', style: { '--i': index } as React.CSSProperties };
}
