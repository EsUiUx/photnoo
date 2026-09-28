'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAdmin } from '@/components/console-shell';
import { Badge, Button, Card, ErrorNote, Loading, PageHeader, Table, Td, useReasonPrompt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { egp, formatBytes, formatDate } from '@/lib/format';
import { type AdminPlan, can } from '@/lib/types';

/**
 * PRD A-04. A new price replaces the plan row from now on; running cycles keep the price they
 * paid, and new purchases and renewals use the new one.
 */
export default function PlansPage() {
  const me = useAdmin();
  const client = useQueryClient();
  const prompt = useReasonPrompt();
  const [error, setError] = useState<string>();
  const [showRetired, setShowRetired] = useState(false);
  const [draft, setDraft] = useState({ tier: '', gb: '', cycle: 'annual' as 'annual' | 'monthly', price: '' });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const plans = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<AdminPlan[]>('/plans') });
  const done = () => {
    setError(undefined);
    void client.invalidateQueries({ queryKey: ['admin', 'plans'] });
  };
  const fail = (err: unknown) => setError(errorMessage(err));

  const create = useMutation({
    mutationFn: () => api('/plans', { body: { tier: draft.tier.toUpperCase(), annualAllowanceGb: Number(draft.gb), cycle: draft.cycle, priceEgp: Number(draft.price) } }),
    onSuccess: () => {
      setDraft({ tier: '', gb: '', cycle: 'annual', price: '' });
      done();
    },
    onError: fail,
  });
  const price = useMutation({
    mutationFn: (input: { id: string; priceEgp: number }) => api(`/plans/${input.id}/price`, { body: { priceEgp: input.priceEgp } }),
    onSuccess: done,
    onError: fail,
  });
  const retire = useMutation({
    mutationFn: (input: { id: string; reason: string }) => api(`/plans/${input.id}/retire`, { body: { reason: input.reason } }),
    onSuccess: done,
    onError: fail,
  });

  const edit = can(me, 'super_admin');
  const rows = plans.data?.filter((p) => showRetired || p.onSale) ?? [];
  const input = 'h-10 rounded-lg border border-line bg-white px-3 text-sm focus:border-primary-300 focus:outline-none';

  return (
    <>
      <PageHeader
        title="Plans & prices"
        subtitle="Allowance is per year; monthly plans get a twelfth each month. Prices in EGP."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
            Show retired
          </label>
        }
      />
      <div className="mb-4">
        <ErrorNote message={error} />
      </div>
      {plans.isPending ? (
        <Loading />
      ) : plans.isError ? (
        <ErrorNote message={errorMessage(plans.error)} />
      ) : (
        <Table head={['Tier', 'Cycle', 'Allowance', 'Price', 'Active subscriptions', 'On sale', '']} empty={rows.length === 0}>
          {rows.map((p) => (
            <tr key={p.id} className={p.onSale ? '' : 'opacity-60'}>
              <Td className="font-semibold">{p.label}</Td>
              <Td>{p.cycle}</Td>
              <Td>
                {formatBytes(p.cycleAllowanceBytes)} / {p.cycle === 'annual' ? 'year' : 'month'}
              </Td>
              <Td className="font-semibold">{egp(p.priceEgp)}</Td>
              <Td>{p.activeSubscriptions}</Td>
              <Td>
                {p.onSale ? <Badge color="green">since {formatDate(p.activeFrom)}</Badge> : <Badge>retired {formatDate(p.activeTo)}</Badge>}
              </Td>
              <Td>
                {edit && p.onSale ? (
                  <div className="flex justify-end gap-2">
                    <input
                      aria-label={`New price for ${p.label} ${p.cycle}`}
                      type="number"
                      min="1"
                      placeholder="New price"
                      value={prices[p.id] ?? ''}
                      onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })}
                      className={`${input} h-8 w-28`}
                    />
                    <Button
                      small
                      disabled={!Number(prices[p.id])}
                      pending={price.isPending && price.variables?.id === p.id}
                      onClick={() => price.mutate({ id: p.id, priceEgp: Number(prices[p.id]) })}
                    >
                      Set price
                    </Button>
                    <Button
                      small
                      tone="ghost"
                      onClick={() =>
                        void prompt
                          .ask(`Stop selling ${p.label} ${p.cycle}?`, { body: 'Photographers on it keep it until renewal.', confirm: 'Retire', tone: 'danger' })
                          .then((reason) => reason && retire.mutate({ id: p.id, reason }))
                      }
                    >
                      Retire
                    </Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {edit ? (
        <Card className="mt-6">
          <p className="mb-3 font-semibold">Add a tier</p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label className="flex flex-col gap-1 text-xs font-medium">
              Tier
              <input className={input} placeholder="750GB" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              GB per year
              <input className={input} type="number" min="1" value={draft.gb} onChange={(e) => setDraft({ ...draft, gb: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Cycle
              <select className={input} value={draft.cycle} onChange={(e) => setDraft({ ...draft, cycle: e.target.value as 'annual' | 'monthly' })}>
                <option value="annual">annual</option>
                <option value="monthly">monthly</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Price (EGP)
              <input className={input} type="number" min="1" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </label>
            <Button type="submit" pending={create.isPending} disabled={!draft.tier || !Number(draft.gb) || !Number(draft.price)}>
              Add
            </Button>
          </form>
        </Card>
      ) : null}
      {prompt.element}
    </>
  );
}
