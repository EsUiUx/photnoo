'use client';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** Inline brand link used in auth copy ("Forgot password?", "Request access"). */
export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline', className)}>
      {children}
    </Link>
  );
}

/** Link-styled button for secondary actions inside a flow ("Resend code", "Use another email"). */
export function TextButton({
  onClick,
  children,
  disabled,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-10 items-center rounded-md text-sm font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline disabled:cursor-not-allowed disabled:text-fg-muted disabled:no-underline',
        className,
      )}
    >
      {children}
    </button>
  );
}
