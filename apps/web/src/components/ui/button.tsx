'use client';

import type { LucideIcon } from 'lucide-react';
import { forwardRef } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { Spinner } from './state';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'inverse' | 'inverse-outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg shadow-xs hover:bg-brand-hover active:bg-brand-active',
  secondary: 'border border-border-strong bg-surface text-fg shadow-xs hover:bg-surface-subtle hover:border-fg-muted/40',
  ghost: 'text-fg-secondary hover:bg-surface-subtle hover:text-fg',
  soft: 'bg-brand-soft text-brand hover:bg-brand-soft-strong',
  danger: 'bg-danger text-white shadow-xs hover:bg-danger-hover',
  inverse: 'bg-white text-brand shadow-xs hover:bg-primary-50',
  'inverse-outline': 'border border-white/70 text-white hover:bg-white/10',
};

// Every size keeps at least a 44px target on touch (md and lg) or pads to it (sm on coarse pointers).
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-sm pointer-coarse:h-11',
  md: 'h-11 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
};

const ICON_SIZES: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  pending?: boolean;
  block?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function buttonClasses({ variant = 'primary', size = 'md', block, className }: Pick<Common, 'variant' | 'size' | 'block' | 'className'>) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors duration-150 select-none',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
}

function Content({ icon: Icon, iconEnd: IconEnd, pending, size = 'md', children }: Common) {
  const px = ICON_SIZES[size];
  return (
    <>
      {pending ? <Spinner size={px} /> : Icon ? <Icon size={px} strokeWidth={1.75} aria-hidden /> : null}
      {children}
      {IconEnd && !pending ? <IconEnd size={px} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" /> : null}
    </>
  );
}

type ButtonProps = Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, iconEnd, pending, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      <Content icon={icon} iconEnd={iconEnd} pending={pending} size={size}>
        {children}
      </Content>
    </button>
  );
});

type LinkProps = Common & { href: string; external?: boolean } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'>;

/** A link styled as a button. Internal hrefs go through the locale-aware router. */
export function ButtonLink({ variant, size, icon, iconEnd, block, className, children, href, external, ...rest }: LinkProps) {
  const classes = buttonClasses({ variant, size, block, className });
  const content = (
    <Content icon={icon} iconEnd={iconEnd} size={size}>
      {children}
    </Content>
  );
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer" {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}

type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  variant?: 'ghost' | 'secondary' | 'danger-ghost' | 'inverse';
  size?: 'sm' | 'md';
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>;

/** Square icon-only button with a required accessible name and a 40px (44px on touch) target. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  const variants = {
    ghost: 'text-fg-secondary hover:bg-surface-subtle hover:text-fg',
    secondary: 'border border-border-strong bg-surface text-fg-secondary shadow-xs hover:bg-surface-subtle hover:text-fg',
    'danger-ghost': 'text-fg-muted hover:bg-danger-soft hover:text-danger',
    inverse: 'bg-black/35 text-white backdrop-blur-sm hover:bg-black/55',
  };
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'size-9 pointer-coarse:size-11' : 'size-10 pointer-coarse:size-11',
        variants[variant],
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 18} strokeWidth={1.75} aria-hidden />
    </button>
  );
});
