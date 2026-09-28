'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { use, useState } from 'react';
import { useAdmin } from '@/components/console-shell';
import { Button, Card, ErrorNote, Loading, PageHeader, StateBadge, Table, Td, useReasonPrompt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { egp, formatBytes, formatDate, formatDateTime, percent } from '@/lib/format';
import { type AdminPlan, can, type PhotographerDetail } from '@/lib/types';

/** PRD A-03: account, plan, galleries (metadata only), logins and payments, with the actions. */
export default function PhotographerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAdmin();
  const client = useQueryClient();
  const prompt = useReasonPrompt();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [planId, setPlanId] = useState('');
  const detail = useQuery({ queryKey: ['admin', 'photographer', id], queryFn: () => api<PhotographerDetail>(`/photographers/${id}`) });
  const plans = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<AdminPlan[]>('/plans'), enabled: can(me, 'operations') });

  const run = useMutation({
    mutationFn: (input: { path: string; body: object; done: string }) => api(input.path, { body: input.body }).then(() => input.done),
    onSuccess: (message) => {
      setError(undefined);
      setNotice(message);
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const action = async (title: string, path: string, done: string, extra: object = {}, tone: 'primary' | 'danger' = 'primary') => {
    const reason = await prompt.ask(title, { confirm: 'Confirm', tone });
    if (reason) run.mutate({ path, body: { reason, ...extra }, done });
  };

  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorNote message={errorMessage(detail.error)} />;
  const p = detail.data;
  const sub = p.subscription;
  const operate = can(me, 'operations');

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={`${p.studioName ? `${p.studioName} · ` : ''}${p.email} · ${p.phone}${p.city ? ` · ${p.city}` : ''}`}
        actions={
          operate ? (
            <div className="flex flex-wrap gap-2">
              <Button tone="ghost" onClick={() => void action('Log this photographer out everywhere?', `/photographers/${id}/force-logout`, 'All sessions ended.')}>
                Force logout
              </Button>
              {p.status === 'active' ? (
                <Button tone="danger" onClick={() => void action(`Suspend ${p.name}?`, `/photographers/${id}/suspend`, 'Suspended. Their links are paused.', {}, 'danger')}>
                  Suspend account
                </Button>
              ) : (
                <Button onClick={() => void action(`Lift the suspension of ${p.name}?`, `/photographers/${id}/unsuspend`, 'Suspension lifted.')}>Unsuspend</Button>
              )}
            </div>
          ) : null
        }
      />
      <div className="mb-4 flex flex-col gap-2">
        <ErrorNote message={error} />
        {notice ? <p className="rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-500">{notice}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-muted">Account</p>
          <div className="mt-2 flex items-center gap-2">
            <StateBadge state={p.status} />
            <span className="text-sm text-ink-muted">joined {formatDate(p.createdAt)} · {p.locale}</span>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Plan</p>
          {sub ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <StateBadge state={sub.state} />
                <span className="font-semibold">{sub.plan ? `${sub.plan.label} · ${sub.plan.cycle}` : 'no plan'}</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {formatDate(sub.cycleStart)} → {formatDate(sub.cycleEnd)} ({sub.daysLeft} days left)
              </p>
              {sub.nextPlan ? <p className="text-sm text-ink-muted">Next: {sub.nextPlan.label} · {sub.nextPlan.cycle}</p> : null}
              {sub.renewalPaid ? <p className="text-sm text-ink-muted">Next cycle paid</p> : null}
            </>
          ) : (
            <p className="mt-2">—</p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Upload allowance this cycle</p>
          {sub ? (
            <>
              <p className="mt-2 text-xl font-bold">
                {formatBytes(sub.usedBytes)} / {formatBytes(sub.allowanceBytes)}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-100">
                <div className="h-full bg-primary-300" style={{ width: `${percent(sub.usedBytes, sub.allowanceBytes)}%` }} />
              </div>
            </>
          ) : null}
        </Card>
      </div>

      {operate ? (
        <Card className="mt-4">
          <p className="mb-3 font-semibold">Plan actions</p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              aria-label="Plan"
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm"
            >
              <option value="">Choose a plan…</option>
              {plans.data
                ?.filter((pl) => pl.onSale)
                .map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.label} · {pl.cycle} · {egp(pl.priceEgp)}
                  </option>
                ))}
            </select>
            <Button
              disabled={!planId}
              onClick={() => void action('Change plan without a payment?', `/photographers/${id}/change-plan`, 'Plan changed.', { planId })}
            >
              Change plan
            </Button>
            <Button tone="ghost" onClick={() => void action('Grant a 30-day, 25 GB trial?', `/photographers/${id}/grant-trial`, 'Trial granted.')}>
              Grant trial
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">A running cycle keeps its dates; otherwise a new cycle starts today. No invoice is issued.</p>
        </Card>
      ) : null}

      <h2 className="mt-8 mb-3 text-lg font-bold">Galleries</h2>
      <Table head={['Gallery', 'State', 'Files', 'Size', 'Served / cap', 'Downloads', 'Expires', '']} empty={p.galleries.length === 0}>
        {p.galleries.map((g) => (
          <tr key={g.id}>
            <Td>
              <p className="font-semibold">{g.name}</p>
              <p className="text-xs text-ink-muted">{g.clientName}</p>
            </Td>
            <Td>
              <StateBadge state={g.state} />
              {g.suspended ? (
                <p className="mt-1 text-xs text-danger">
                  suspended{g.suspendedUntil ? ` until ${formatDateTime(g.suspendedUntil)}` : ''}
                  {g.suspendedReason ? ` · ${g.suspendedReason}` : ''}
                </p>
              ) : null}
            </Td>
            <Td>{g.fileCount}</Td>
            <Td>{formatBytes(g.totalBytes)}</Td>
            <Td>
              {formatBytes(g.servedBytes)} / {formatBytes(g.capBytes)}
            </Td>
            <Td>{g.receipts}</Td>
            <Td className="whitespace-nowrap">{formatDate(g.expiresAt)}</Td>
            <Td>
              {operate && g.state === 'active' ? (
                g.suspended ? (
                  <Button small tone="ghost" onClick={() => void action(`Unsuspend “${g.name}”?`, `/galleries/${g.id}/unsuspend`, 'Gallery unsuspended.')}>
                    Unsuspend
                  </Button>
                ) : (
                  <Button small tone="danger" onClick={() => void action(`Suspend “${g.name}”?`, `/galleries/${g.id}/suspend`, 'Gallery suspended.', {}, 'danger')}>
                    Suspend
                  </Button>
                )
              ) : null}
            </Td>
          </tr>
        ))}
      </Table>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold">Logins</h2>
          <Table head={['Signed in', 'Last used', 'IP', 'Device', '']} empty={p.logins.length === 0}>
            {p.logins.map((s) => (
              <tr key={s.id}>
                <Td className="whitespace-nowrap">{formatDateTime(s.createdAt)}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(s.lastUsedAt)}</Td>
                <Td className="font-mono text-xs">{s.ip ?? '—'}</Td>
                <Td className="max-w-[220px] truncate text-xs text-ink-muted" >
                  <span title={s.userAgent ?? ''}>{s.userAgent ?? '—'}</span>
                </Td>
                <Td>{s.active ? <StateBadge state="active" /> : null}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">Payments</h2>
          <Table head={['Date', 'Reference', 'Plan', 'Amount', 'Status']} empty={p.payments.length === 0}>
            {p.payments.map((pay) => (
              <tr key={pay.id}>
                <Td className="whitespace-nowrap">{formatDate(pay.decidedAt ?? pay.createdAt)}</Td>
                <Td className="font-mono">{pay.reference}</Td>
                <Td>
                  {pay.plan.label} · {pay.plan.cycle}
                </Td>
                <Td>{egp(pay.amountEgp)}</Td>
                <Td>
                  <StateBadge state={pay.status} />
                  {pay.invoice ? <p className="text-xs text-ink-muted">{pay.invoice.number}</p> : null}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
      {prompt.element}
    </>
  );
}
