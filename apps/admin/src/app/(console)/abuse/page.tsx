'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useAdmin } from '@/components/console-shell';
import { Button, Card, ErrorNote, Loading, PageHeader, StateBadge, Table, Tabs, Td, useReasonPrompt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import { type AbuseReport, can } from '@/lib/types';

type Status = AbuseReport['status'];
type CaseView = { reportId: string; expiresAt: string; files: Array<{ id: string; name: string; url: string; width: number | null; height: number | null }> };

/**
 * PRD A-07. Admins see gallery metadata only. A Super Admin may open the previews for a stated
 * case: the view lasts 15 minutes and is written to the audit log with the reason.
 */
export default function AbusePage() {
  const me = useAdmin();
  const client = useQueryClient();
  const prompt = useReasonPrompt();
  const [status, setStatus] = useState<Status>('open');
  const [error, setError] = useState<string>();
  const [view, setView] = useState<CaseView | null>(null);
  const list = useQuery({ queryKey: ['admin', 'abuse', status], queryFn: () => api<AbuseReport[]>(`/abuse?status=${status}`) });

  const decide = useMutation({
    mutationFn: (input: { id: string; status: 'actioned' | 'dismissed'; note: string; suspendGallery: boolean }) =>
      api(`/abuse/${input.id}/decide`, { body: { status: input.status, note: input.note, suspendGallery: input.suspendGallery } }),
    onSuccess: () => {
      setError(undefined);
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  async function openCase(report: AbuseReport) {
    const reason = await prompt.ask('Open this gallery for review?', {
      body: 'You will see the previews for 15 minutes. This is logged with your reason and visible to other Super Admins.',
      confirm: 'Open previews',
      tone: 'danger',
    });
    if (!reason) return;
    try {
      const result = await api<Omit<CaseView, 'reportId'>>(`/abuse/${report.id}/view`, { body: { reason } });
      setView({ ...result, reportId: report.id });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const ask = async (report: AbuseReport, outcome: 'actioned' | 'dismissed', suspendGallery: boolean) => {
    const note = await prompt.ask(
      outcome === 'dismissed' ? 'Dismiss this report?' : suspendGallery ? 'Suspend the gallery and close the report?' : 'Mark as actioned?',
      { confirm: outcome === 'dismissed' ? 'Dismiss' : 'Confirm', tone: suspendGallery ? 'danger' : 'primary' },
    );
    if (note) decide.mutate({ id: report.id, status: outcome, note, suspendGallery });
  };

  const superAdmin = can(me, 'super_admin');
  return (
    <>
      <PageHeader title="Abuse reports" subtitle="Reports sent from the client gallery footer." />
      <Tabs
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'actioned', label: 'Actioned' },
          { value: 'dismissed', label: 'Dismissed' },
        ]}
      />
      <div className="mb-4">
        <ErrorNote message={error} />
      </div>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorNote message={errorMessage(list.error)} />
      ) : (
        <Table head={['Reported', 'Reason', 'Gallery', 'Photographer', 'Status', '']} empty={list.data.length === 0}>
          {list.data.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(r.createdAt)}</Td>
              <Td className="max-w-[320px]">
                <p>{r.reason}</p>
                {r.reporterEmail ? <p className="mt-1 text-xs text-ink-muted">from {r.reporterEmail}</p> : null}
              </Td>
              <Td>
                <p className="font-semibold">{r.gallery.name}</p>
                <p className="text-xs text-ink-muted">
                  {r.gallery.fileCount} files · {formatBytes(r.gallery.totalBytes)} · {r.gallery.reports} report{r.gallery.reports === 1 ? '' : 's'}
                </p>
                <div className="mt-1 flex gap-1">
                  <StateBadge state={r.gallery.state} />
                  {r.gallery.suspended ? <StateBadge state="suspended" /> : null}
                </div>
              </Td>
              <Td>
                <Link href={`/photographers/${r.gallery.photographer.id}`} className="text-primary-400 underline">
                  {r.gallery.photographer.name}
                </Link>
                <p className="text-xs text-ink-muted">{r.gallery.photographer.email}</p>
              </Td>
              <Td>
                <StateBadge state={r.status} />
                {r.decisionNote ? <p className="mt-1 text-xs text-ink-muted">{r.decisionNote}</p> : null}
              </Td>
              <Td>
                {r.status === 'open' && can(me, 'operations') ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {superAdmin ? (
                      <>
                        <Button small tone="ghost" onClick={() => void openCase(r)}>
                          Review content
                        </Button>
                        <Button small tone="danger" onClick={() => void ask(r, 'actioned', true)}>
                          Suspend gallery
                        </Button>
                      </>
                    ) : null}
                    <Button small tone="ghost" onClick={() => void ask(r, 'dismissed', false)}>
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {view ? (
        <Card className="mt-6 border-danger/40">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-danger">Logged case review · previews expire {formatDateTime(view.expiresAt)}</p>
            <Button small tone="ghost" onClick={() => setView(null)}>
              Close
            </Button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {view.files.map((f) => (
              <li key={f.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed preview */}
                <img src={f.url} alt={f.name} referrerPolicy="no-referrer" className="aspect-square w-full rounded-lg object-cover" />
                <p className="mt-1 truncate text-xs text-ink-muted">{f.name}</p>
              </li>
            ))}
          </ul>
          {view.files.length === 0 ? <p className="text-ink-muted">This gallery has no previews.</p> : null}
        </Card>
      ) : null}
      {prompt.element}
    </>
  );
}
