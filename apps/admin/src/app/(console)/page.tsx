'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, ErrorNote, Loading, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { egp, formatBytes } from '@/lib/format';
import type { Overview } from '@/lib/types';

/** PRD A-09. Refreshes every 30 seconds. */
export default function OverviewPage() {
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api<Overview>('/overview'), refetchInterval: 30_000 });
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorNote message={errorMessage(overview.error)} />;
  const o = overview.data;

  const tiles: Array<{ label: string; value: string | number; href?: string; alert?: boolean }> = [
    { label: 'Paying photographers', value: o.payingPhotographers, href: '/photographers' },
    { label: 'On trial', value: o.trials },
    { label: 'Lapsed (soft-locked or dormant)', value: o.lapsed },
    { label: 'Payments to review', value: o.pendingPayments, href: '/payments', alert: o.pendingPayments > 0 },
    { label: 'Payments awaiting receipt', value: o.awaitingProof, href: '/payments' },
    { label: 'Applications to review', value: o.pendingApplications, href: '/applications', alert: o.pendingApplications > 0 },
    { label: 'Open abuse reports', value: o.openAbuseReports, href: '/abuse', alert: o.openAbuseReports > 0 },
    { label: 'Active galleries', value: o.activeGalleries },
    { label: 'Uploaded today', value: formatBytes(o.uploadedTodayBytes) },
    { label: 'Downloaded today', value: formatBytes(o.downloadedTodayBytes) },
    { label: 'Revenue this month', value: egp(o.revenueThisMonthEgp) },
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Today and this month in Cairo time." />
      {o.switchesOn.length > 0 ? (
        <p role="alert" className="mb-6 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          Emergency switch on: {o.switchesOn.join(', ').replace(/_/g, ' ')} ·{' '}
          <Link href="/switches" className="underline">
            Manage
          </Link>
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <Card className={`h-full ${tile.alert ? 'border-[#f5c77e] bg-warn-bg' : ''}`}>
              <p className="text-sm text-ink-muted">{tile.label}</p>
              <p className="mt-2 text-3xl font-bold text-primary-900">{tile.value}</p>
            </Card>
          );
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="block hover:opacity-90">
              {body}
            </Link>
          ) : (
            <div key={tile.label}>{body}</div>
          );
        })}
      </div>
    </>
  );
}
