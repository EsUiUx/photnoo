'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ErrorNote } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

/** Password plus a code from the authenticator app; there is no way around the code. */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await api('/auth/login', { body: { email, password, code } });
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
    } finally {
      setPending(false);
    }
  }

  const field = 'h-11 w-full rounded-lg border border-line bg-white px-3 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:outline-none';
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-white p-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src="/logo.svg" alt="Photnoo" className="h-6 w-auto" />
          <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-bold tracking-wide text-primary-500 uppercase">Admin</span>
        </div>
        <h1 className="text-xl font-bold text-primary-900">Sign in</h1>
        <ErrorNote message={error} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input className={field} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input className={field} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Authenticator code
          <input
            className={`${field} font-mono tracking-[0.4em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <Button type="submit" pending={pending}>
          Sign in
        </Button>
        <p className="text-xs text-ink-muted">Every sign-in and action is recorded in the audit log.</p>
      </form>
    </main>
  );
}
