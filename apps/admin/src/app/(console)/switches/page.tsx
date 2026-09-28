'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAdmin } from '@/components/console-shell';
import { Button, Card, ErrorNote, Loading, PageHeader, useReasonPrompt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, type Switch } from '@/lib/types';

const INFO: Record<Switch['key'], { title: string; body: string }> = {
  uploads_frozen: { title: 'Freeze uploads', body: 'Photographers cannot start or finish uploads. Uploads resume on their own when lifted.' },
  downloads_frozen: { title: 'Freeze downloads', body: 'Clients can still open galleries and see previews, but originals cannot be downloaded.' },
  maintenance: { title: 'Maintenance mode', body: 'Every page and API call answers 503 “under maintenance”, except this admin app.' },
};

/** PRD A-05. Each switch needs a reason and reaches every server within a minute. */
export default function SwitchesPage() {
  const me = useAdmin();
  const client = useQueryClient();
  const prompt = useReasonPrompt();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const switches = useQuery({ queryKey: ['admin', 'switches'], queryFn: () => api<Switch[]>('/switches') });

  const toggle = useMutation({
    mutationFn: (input: { key: string; on: boolean; reason: string }) => api(`/switches/${input.key}`, { method: 'PUT', body: { on: input.on, reason: input.reason } }),
    onSuccess: () => {
      setError(undefined);
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const logoutAll = useMutation({
    mutationFn: (reason: string) => api<{ sessions: number }>('/switches/logout-all', { body: { reason } }),
    onSuccess: (r) => setNotice(`${r.sessions} photographer sessions ended.`),
    onError: (err) => setError(errorMessage(err)),
  });

  const edit = can(me, 'super_admin');
  return (
    <>
      <PageHeader title="Emergency switches" subtitle={edit ? 'Super Admin only. Every change is audited.' : 'Read only for your role.'} />
      <div className="mb-4 flex flex-col gap-2">
        <ErrorNote message={error} />
        {notice ? <p className="rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-500">{notice}</p> : null}
      </div>
      {switches.isPending ? (
        <Loading />
      ) : switches.isError ? (
        <ErrorNote message={errorMessage(switches.error)} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {switches.data.map((s) => (
            <Card key={s.key} className={s.on ? 'border-danger bg-danger-bg' : ''}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-bold">{INFO[s.key].title}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.on ? 'bg-danger text-white' : 'bg-primary-100 text-primary-500'}`}>{s.on ? 'ON' : 'off'}</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{INFO[s.key].body}</p>
              {s.updatedAt ? (
                <p className="mt-3 text-xs text-ink-muted">
                  Last changed {formatDateTime(s.updatedAt)}
                  {s.reason ? ` · “${s.reason}”` : ''}
                </p>
              ) : null}
              {edit ? (
                <div className="mt-4">
                  <Button
                    tone={s.on ? 'primary' : 'danger'}
                    pending={toggle.isPending && toggle.variables?.key === s.key}
                    onClick={() =>
                      void prompt
                        .ask(s.on ? `Turn off “${INFO[s.key].title}”?` : `Turn on “${INFO[s.key].title}”?`, { confirm: s.on ? 'Turn off' : 'Turn on', tone: s.on ? 'primary' : 'danger' })
                        .then((reason) => reason && toggle.mutate({ key: s.key, on: !s.on, reason }))
                    }
                  >
                    {s.on ? 'Turn off' : 'Turn on'}
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
          <Card>
            <p className="text-lg font-bold">Log out all photographers</p>
            <p className="mt-2 text-sm text-ink-muted">Ends every photographer session within a minute. Client galleries keep working.</p>
            {edit ? (
              <div className="mt-4">
                <Button
                  tone="danger"
                  pending={logoutAll.isPending}
                  onClick={() =>
                    void prompt
                      .ask('Log out every photographer?', { confirm: 'Log everyone out', tone: 'danger' })
                      .then((reason) => reason && logoutAll.mutate(reason))
                  }
                >
                  Log everyone out
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      )}
      {prompt.element}
    </>
  );
}
