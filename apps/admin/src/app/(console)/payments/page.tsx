'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useAdmin } from '@/components/console-shell';
import { Button, ErrorNote, Loading, PageHeader, StateBadge, Table, Tabs, Td, useReasonPrompt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { egp, formatDateTime } from '@/lib/format';
import { can, type Payment } from '@/lib/types';

type Status = 'open' | 'approved' | 'rejected';

/**
 * PRD A-02: compare the receipt with the reference, amount and method, then approve (starts
 * the plan and issues the invoice) or reject with a reason (emailed to the photographer).
 */
export default function PaymentsPage() {
  const me = useAdmin();
  const client = useQueryClient();
  const [status, setStatus] = useState<Status>('open');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const prompt = useReasonPrompt();
  const list = useQuery({ queryKey: ['admin', 'payments', status], queryFn: () => api<Payment[]>(`/payments?status=${status}`) });

  const done = () => void client.invalidateQueries({ queryKey: ['admin'] });
  const approve = useMutation({
    mutationFn: (id: string) => api<{ invoice: string }>(`/payments/${id}/approve`, { method: 'POST' }),
    onSuccess: (r) => {
      setError(undefined);
      setNotice(`Approved. Invoice ${r.invoice} issued and emailed.`);
      done();
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: (input: { id: string; reason: string }) => api(`/payments/${input.id}/reject`, { body: { reason: input.reason } }),
    onSuccess: () => {
      setNotice('Rejected. The photographer was emailed the reason.');
      done();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  async function openReceipt(id: string) {
    try {
      const { url } = await api<{ url: string }>(`/payments/${id}/proof`);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const operate = can(me, 'operations');
  return (
    <>
      <PageHeader title="Payments" subtitle="Manual InstaPay, Vodafone Cash and bank transfers. Match the reference in the transfer note." />
      <Tabs
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'To review' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />
      <div className="mb-4 flex flex-col gap-2">
        <ErrorNote message={error} />
        {notice ? <p className="rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-500">{notice}</p> : null}
      </div>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorNote message={errorMessage(list.error)} />
      ) : (
        <Table head={['Submitted', 'Reference', 'Photographer', 'Plan', 'Asked / declared', 'Receipt', 'Status', '']} empty={list.data.length === 0}>
          {list.data.map((p) => {
            const mismatch = p.declaredAmountEgp !== null && p.declaredAmountEgp !== p.amountEgp;
            return (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(p.submittedAt ?? p.createdAt)}</Td>
                <Td className="font-mono font-semibold">{p.reference}</Td>
                <Td>
                  {p.photographer ? (
                    <Link href={`/photographers/${p.photographer.id}`} className="font-semibold text-primary-400 underline">
                      {p.photographer.name}
                    </Link>
                  ) : null}
                  <p className="text-xs text-ink-muted">{p.photographer?.email}</p>
                </Td>
                <Td>
                  {p.plan.label} · {p.plan.cycle}
                  <p className="text-xs text-ink-muted">{p.kind}</p>
                </Td>
                <Td>
                  <p className="font-semibold">{egp(p.amountEgp)}</p>
                  <p className={`text-xs ${mismatch ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
                    {p.declaredAmountEgp !== null ? `${egp(p.declaredAmountEgp)} via ${p.method?.replace('_', ' ')}` : 'no receipt yet'}
                  </p>
                </Td>
                <Td>
                  {p.hasProof ? (
                    <button type="button" onClick={() => void openReceipt(p.id)} className="text-primary-400 underline">
                      View
                    </button>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  <StateBadge state={p.status} />
                  {p.rejectReason ? <p className="mt-1 text-xs text-ink-muted">{p.rejectReason}</p> : null}
                  {p.invoice ? <p className="mt-1 text-xs text-ink-muted">{p.invoice.number}</p> : null}
                </Td>
                <Td>
                  {operate && (p.status === 'pending' || p.status === 'awaiting_proof') ? (
                    <div className="flex justify-end gap-2">
                      {p.status === 'pending' ? (
                        <Button small pending={approve.isPending && approve.variables === p.id} onClick={() => approve.mutate(p.id)}>
                          Approve
                        </Button>
                      ) : null}
                      <Button
                        small
                        tone="danger"
                        onClick={() =>
                          void prompt
                            .ask(`Reject ${p.reference}?`, { body: 'The reason is emailed to the photographer.', confirm: 'Reject', tone: 'danger' })
                            .then((reason) => reason && reject.mutate({ id: p.id, reason }))
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
      {prompt.element}
    </>
  );
}
