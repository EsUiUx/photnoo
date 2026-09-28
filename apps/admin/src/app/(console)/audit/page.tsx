'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAdmin } from '@/components/console-shell';
import { Badge, Button, ErrorNote, Loading, PageHeader, Table, Td } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type AuditItem, can } from '@/lib/types';

/** PRD A-08: every admin sign-in and action, hash-chained so edits are detectable. */
export default function AuditPage() {
  const me = useAdmin();
  const [filters, setFilters] = useState({ action: '', targetId: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const query = new URLSearchParams(Object.entries(applied).filter(([, v]) => v) as Array<[string, string]>);

  const log = useInfiniteQuery({
    queryKey: ['admin', 'audit', applied],
    queryFn: ({ pageParam }) => api<{ items: AuditItem[]; nextBefore: string | null }>(`/audit?${query}${pageParam ? `&before=${pageParam}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
  const verify = useQuery({
    queryKey: ['admin', 'audit', 'verify'],
    queryFn: () => api<{ checked: number; brokenAt: string | null }>('/audit/verify'),
    enabled: false,
  });

  const input = 'h-10 rounded-lg border border-line bg-white px-3 text-sm focus:border-primary-300 focus:outline-none';
  const items = log.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only. Kept for two years."
        actions={
          can(me, 'super_admin') ? (
            <div className="flex items-center gap-3">
              {verify.data ? (
                verify.data.brokenAt ? (
                  <Badge color="red">Chain broken at #{verify.data.brokenAt}</Badge>
                ) : (
                  <Badge color="green">{verify.data.checked} entries verified</Badge>
                )
              ) : null}
              <Button tone="ghost" pending={verify.isFetching} onClick={() => void verify.refetch()}>
                Verify chain
              </Button>
            </div>
          ) : null
        }
      />
      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-medium">
          Action starts with
          <input className={input} placeholder="payment." value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Target ID
          <input className={`${input} w-80 font-mono`} value={filters.targetId} onChange={(e) => setFilters({ ...filters, targetId: e.target.value.trim() })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          From
          <input className={input} type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To
          <input className={input} type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <Button type="submit">Filter</Button>
      </form>
      {verify.isError ? <ErrorNote message={errorMessage(verify.error)} /> : null}
      {log.isPending ? (
        <Loading />
      ) : log.isError ? (
        <ErrorNote message={errorMessage(log.error)} />
      ) : (
        <>
          <Table head={['#', 'When', 'Who', 'Action', 'Target', 'Reason', 'IP']} empty={items.length === 0}>
            {items.map((row) => (
              <tr key={row.id}>
                <Td className="font-mono text-xs text-ink-muted">{row.id}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(row.createdAt)}</Td>
                <Td>
                  <p className="font-medium">{row.actorName ?? row.actorType}</p>
                  {row.actorId && !row.actorName ? <p className="font-mono text-[10px] text-ink-muted">{row.actorId}</p> : null}
                </Td>
                <Td className="font-mono text-xs">{row.action}</Td>
                <Td>
                  <p className="text-xs">{row.targetType}</p>
                  <button
                    type="button"
                    className="font-mono text-[10px] text-primary-400 underline"
                    onClick={() => {
                      const next = { ...filters, targetId: row.targetId ?? '' };
                      setFilters(next);
                      setApplied(next);
                    }}
                  >
                    {row.targetId}
                  </button>
                </Td>
                <Td className="max-w-[280px] text-xs">{row.reason ?? (row.data ? <code className="break-all text-ink-muted">{JSON.stringify(row.data)}</code> : '—')}</Td>
                <Td className="font-mono text-xs">{row.ip ?? '—'}</Td>
              </tr>
            ))}
          </Table>
          {log.hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <Button tone="ghost" pending={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
                Load older
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
