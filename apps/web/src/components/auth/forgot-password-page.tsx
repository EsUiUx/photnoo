'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AuthShell } from './auth-shell';
import { ForgotPasswordFlow } from './forgot-password-flow';

const COPY = {
  email: { title: 'emailTitle', subtitle: 'emailSubtitle' },
  code: { title: 'codeTitle', subtitle: 'codeSubtitle' },
  password: { title: 'passwordTitle', subtitle: 'passwordSubtitle' },
} as const;

/** The heading follows the step, so this page renders the shell on the client. */
export function ForgotPasswordPage() {
  const t = useTranslations('Reset');
  const [step, setStep] = useState<keyof typeof COPY>('email');
  const copy = COPY[step];
  return (
    <AuthShell title={t(copy.title)} subtitle={t(copy.subtitle)}>
      <ForgotPasswordFlow onStepChange={setStep} />
    </AuthShell>
  );
}
