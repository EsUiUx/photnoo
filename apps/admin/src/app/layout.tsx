import type { Metadata } from 'next';
import { Albert_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const latin = Albert_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-latin', display: 'swap' });

export const metadata: Metadata = {
  title: 'Photnoo Admin',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={latin.variable}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
