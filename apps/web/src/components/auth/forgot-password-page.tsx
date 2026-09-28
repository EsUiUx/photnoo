'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { isolate } from '@/lib/format';
import { AuthShell } from './auth-shell';
import { ForgotPasswordFlow, type Step } from './forgot-password-flow';

const COPY = {
  email: { title: 'emailTitle', subtitle: 'emailSubtitle' },
  code: { title: 'codeTitle', subtitle: 'codeSubtitle' },
  password: { title: 'passwordTitle', subtitle: 'passwordSubtitle' },
} as const;

/**
 * The heading follows the step, so this page renders the shell on the client. On every step
 * change focus moves to the new heading, so keyboard and screen-reader users hear where they are.
 */
export function ForgotPasswordPage() {
  const t = useTranslations('Reset');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [changes, setChanges] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const copy = COPY[step];

  useEffect(() => {
    if (changes > 0) titleRef.current?.focus();
  }, [changes]);

  return (
    <AuthShell
      photo="photographer"
      titleRef={titleRef}
      title={t(copy.title)}
      subtitle={t(copy.subtitle, { email: isolate(email) })}
    >
      <ForgotPasswordFlow
        onStepChange={(next, forEmail) => {
          setStep(next);
          setEmail(forEmail);
          setChanges((n) => n + 1);
        }}
      />
    </AuthShell>
  );
}
