import { PageTransition } from '@/components/motion/page-transition';

/** Remounts on every navigation, so the page transition plays between routes. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
