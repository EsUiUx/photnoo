'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAdmin } from '@/components/console-shell';
import { Badge, Button, ErrorNote, Loading, PageHeader, StateBadge, Table, Tabs, Td, useReasonPrompt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type Application, can } from '@/lib/types';

type Status = Application['status'];

/** PRD A-01: approve (with or without a 30-day trial) or reject with a reason; both send email. */
export default function ApplicationsPage() {
  const me = useAdmin();
  const client = useQueryClient();
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string>();
  const prompt = useReasonPrompt();
  const list = useQuery({ queryKey: ['admin', 'applications', status], queryFn: () => api<Application[]>(`/applications?status=${status}`) });

  const act = useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'reject'; grantTrial?: boolean; reason?: string }) =>
      input.action === 'approve'
        ? api(`/applications/${input.id}/approve`, { body: { grantTrial: input.grantTrial ?? false } })
        : api(`/applications/${input.id}/reject`, { body: { reason: input.reason } }),
    onSuccess: () => {
      setError(undefined);
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const operate = can(me, 'operations');

  return (
    <>
      <PageHeader title="Applications" subtitle="Photographers asking to join. Approval emails a 7-day invite link." />
      <Tabs
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: 'To review' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
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
        <Table head={['Applied', 'Photographer', 'Contact', 'Portfolio', 'Status', '']} empty={list.data.length === 0}>
          {list.data.map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(a.createdAt)}</Td>
              <Td>
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-ink-muted">
                  {a.studioName ? `${a.studioName} · ` : ''}
                  {a.city}
                </p>
              </Td>
              <Td>
                <p>{a.email}</p>
                <p className="text-xs text-ink-muted">{a.phone}</p>
              </Td>
              <Td>
                <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary-400 underline">
                  {a.portfolioUrl.replace(/^https?:\/\//, '')}
                </a>
              </Td>
              <Td>
                <StateBadge state={a.status} />
                {a.grantTrial ? <span className="ms-2"><Badge color="purple">trial</Badge></span> : null}
                {a.hadTrial && a.status === 'pending' ? <p className="mt-1 text-xs text-danger">Already had a trial</p> : null}
                {a.decisionReason ? <p className="mt-1 text-xs text-ink-muted">{a.decisionReason}</p> : null}
              </Td>
              <Td>
                {a.status === 'pending' && operate ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {!a.hadTrial ? (
                      <Button small pending={act.isPending} onClick={() => act.mutate({ id: a.id, action: 'approve', grantTrial: true })}>
                        Approve + trial
                      </Button>
                    ) : null}
                    <Button small tone="ghost" pending={act.isPending} onClick={() => act.mutate({ id: a.id, action: 'approve', grantTrial: false })}>
                      Approve
                    </Button>
                    <Button
                      small
                      tone="danger"
                      onClick={() =>
                        void prompt
                          .ask(`Reject ${a.name}?`, { body: 'The reason is emailed to the applicant.', confirm: 'Reject', tone: 'danger' })
                          .then((reason) => reason && act.mutate({ id: a.id, action: 'reject', reason }))
                      }
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {prompt.element}
    </>
  );
}
