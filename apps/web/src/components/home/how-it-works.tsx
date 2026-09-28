import { CheckCheck, Download, Eye, FileImage, Link2, LockKeyhole, UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Reveal, Stagger } from '@/components/motion/reveal';
import { staggerItem } from '@/components/motion/stagger-item';

/**
 * Three steps, each shown as a slice of the real product rather than an icon tile: the upload
 * queue, the two WhatsApp messages, and the proof log. The numbers carry the sequence.
 */
export function HowItWorks() {
  const t = useTranslations('Home.how');
  const steps = [
    { key: 'upload', demo: <UploadDemo /> },
    { key: 'share', demo: <ShareDemo /> },
    { key: 'proof', demo: <ProofDemo /> },
  ] as const;
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-surface-subtle">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <Reveal className="max-w-2xl">
          <h2 id="how-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-fg-muted">{t('subtitle')}</p>
        </Reveal>
        <Stagger as="ol" className="mt-14 grid gap-6 lg:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.key} {...staggerItem(i)} className="flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card">
              <div aria-hidden className="h-60">
                {step.demo}
              </div>
              <div className="mt-6 flex items-start gap-4 border-t border-border pt-6">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-fg tabular">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{t(`${step.key}.title`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{t(`${step.key}.body`)}</p>
                </div>
              </div>
            </li>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function UploadDemo() {
  const t = useTranslations('Home.how.demo');
  const files = [
    { name: 'DSC_4121.jpg', size: '18.4 MB', done: 100 },
    { name: 'DSC_4122.CR3', size: '31.2 MB', done: 64 },
    { name: 'DSC_4123.jpg', size: '17.9 MB', done: 22 },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface-subtle px-4 py-5 text-sm text-fg-muted">
        <UploadCloud size={20} strokeWidth={1.75} className="text-brand" />
        <span className="font-medium text-fg">{t('uploading')}</span>
        <span className="ms-auto tabular">{t('left')}</span>
      </div>
      {files.map((f) => (
        <div key={f.name} className="flex items-center gap-3 rounded-md px-1 py-1.5">
          <FileImage size={18} strokeWidth={1.75} className="shrink-0 text-fg-muted" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="truncate font-medium text-fg" dir="ltr">
                {f.name}
              </span>
              <span className="shrink-0 text-fg-muted tabular" dir="ltr">
                {f.size}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-brand" style={{ width: `${f.done}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShareDemo() {
  const t = useTranslations('Home.how.demo');
  return (
    <div className="flex h-full flex-col justify-center gap-3 rounded-lg bg-[#e9efe9] p-4">
      <div className="max-w-[88%] self-end rounded-lg rounded-se-sm bg-[#d9fdd3] px-3.5 py-2.5 text-sm text-[#0b3d1f] shadow-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <Link2 size={15} strokeWidth={2} />
          {t('linkMessage')}
        </p>
        <p className="mt-1 truncate text-[#1b5e37] underline" dir="ltr">
          photnoo.com/g/VoDw7NveRYS
        </p>
        <p className="mt-1 flex items-center justify-end gap-1 text-xs text-[#3b6b4d]">
          {t('sent')} <CheckCheck size={14} strokeWidth={2} />
        </p>
      </div>
      <div className="max-w-[88%] self-end rounded-lg rounded-se-sm bg-[#d9fdd3] px-3.5 py-2.5 text-sm text-[#0b3d1f] shadow-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <LockKeyhole size={15} strokeWidth={2} />
          <span dir="ltr">{t('passwordMessage')}</span>
        </p>
        <p className="mt-1 flex items-center justify-end gap-1 text-xs text-[#3b6b4d]">
          {t('sent')} <CheckCheck size={14} strokeWidth={2} />
        </p>
      </div>
    </div>
  );
}

function ProofDemo() {
  const t = useTranslations('Home.how.demo');
  const rows = [
    { icon: Download, text: t('downloadedAll'), meta: t('iphone'), time: '21:14' },
    { icon: Download, text: t('downloadedOne'), meta: t('desktop'), time: '19:02' },
    { icon: Eye, text: t('opened'), meta: t('iphone'), time: '18:47' },
  ];
  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 text-xs font-medium text-fg-muted">{t('today')}</p>
      <ul className="relative flex flex-col gap-4 before:absolute before:inset-y-2 before:start-[15px] before:w-px before:bg-border">
        {rows.map((r, i) => (
          <li key={i} className="relative flex items-center gap-3">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand">
              <r.icon size={15} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{r.text}</p>
              <p className="text-xs text-fg-muted">{r.meta}</p>
            </div>
            <span className="text-xs text-fg-muted tabular">{r.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
