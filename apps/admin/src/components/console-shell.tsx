'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { type AdminMe, type AdminRole, can } from '@/lib/types';

const MeContext = createContext<AdminMe | undefined>(undefined);
export const useAdmin = () => useContext(MeContext);

const NAV: Array<{ href: string; label: string; role?: AdminRole }> = [
  { href: '/', label: 'Overview' },
  { href: '/applications', label: 'Applications' },
  { href: '/payments', label: 'Payments' },
  { href: '/photographers', label: 'Photographers' },
  { href: '/abuse', label: 'Abuse reports' },
  { href: '/plans', label: 'Plans & prices' },
  { href: '/switches', label: 'Emergency switches' },
  { href: '/audit', label: 'Audit log' },
];

const ROLE_LABEL: Record<AdminRole, string> = { super_admin: 'Super Admin', operations: 'Operations', support: 'Support' };

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: () => api<AdminMe>('/auth/me') });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
  }, [me.error, router]);

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  return (
    <MeContext.Provider value={me.data}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-e border-primary-300 bg-primary-500 text-primary-50 max-md:hidden">
          <div className="flex items-center gap-2 px-5 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
            <img src="/logo.svg" alt="Photnoo" className="h-5 w-auto brightness-0 invert" />
            <span className="rounded bg-primary-200 px-1.5 text-[10px] font-bold tracking-wide text-primary-500 uppercase">Admin</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            {NAV.filter((n) => !n.role || can(me.data, n.role)).map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-primary-200 text-primary-500' : 'hover:bg-primary-400'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-primary-400 p-4 text-sm">
            <p className="truncate font-semibold">{me.data?.name ?? ' '}</p>
            <p className="text-xs text-primary-200">{me.data ? ROLE_LABEL[me.data.role] : ' '}</p>
            <button type="button" onClick={() => void signOut()} className="mt-3 text-xs font-semibold underline">
              Sign out
            </button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <nav className="flex gap-3 overflow-x-auto border-b border-line bg-white px-4 py-2 text-sm md:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap font-medium text-primary-500">
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </MeContext.Provider>
  );
}
