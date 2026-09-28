'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorNote, Loading, PageHeader, StateBadge, Table, Td } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatBytes, formatDate, percent } from '@/lib/format';
import type { PhotographerRow } from '@/lib/types';

export default function PhotographersPage() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useQuery({
    queryKey: ['admin', 'photographers', term],
    queryFn: () => api<{ items: PhotographerRow[] }>(`/photographers${term ? `?q=${encodeURIComponent(term)}` : ''}`),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        title="Photographers"
        actions={
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, studio, email or phone"
            aria-label="Search photographers"
            className="h-10 w-80 rounded-lg border border-line bg-white px-3 text-sm focus:border-primary-300 focus:outline-none"
          />
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorNote message={errorMessage(list.error)} />
      ) : (
        <Table head={['Photographer', 'Contact', 'Account', 'Plan', 'Allowance used', 'Galleries', 'Joined']} empty={list.data.items.length === 0}>
          {list.data.items.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link href={`/photographers/${p.id}`} className="font-semibold text-primary-400 underline">
                  {p.name}
                </Link>
                <p className="text-xs text-ink-muted">{p.studioName ?? p.city}</p>
              </Td>
              <Td>
                <p>{p.email}</p>
                <p className="text-xs text-ink-muted">{p.phone}</p>
              </Td>
              <Td>
                <StateBadge state={p.status} />
              </Td>
              <Td>
                {p.subscription ? <StateBadge state={p.subscription.state} /> : '—'}
                <p className="mt-1 text-xs text-ink-muted">
                  {p.subscription?.plan ? `${p.subscription.plan.label} · ${p.subscription.plan.cycle}` : ''}
                  {p.subscription ? ` until ${formatDate(p.subscription.cycleEnd)}` : ''}
                </p>
              </Td>
              <Td>
                {p.subscription ? (
                  <>
                    {formatBytes(p.subscription.usedBytes)} / {formatBytes(p.subscription.allowanceBytes)}
                    <p className="text-xs text-ink-muted">{percent(p.subscription.usedBytes, p.subscription.allowanceBytes)}%</p>
                  </>
                ) : (
                  '—'
                )}
              </Td>
              <Td>{p.galleries}</Td>
              <Td className="whitespace-nowrap text-ink-muted">{formatDate(p.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
