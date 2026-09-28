import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

const KEYS = ['client', 'expiry', 'allowance', 'files', 'pay', 'privacy'] as const;

/** Native <details> disclosure: keyboard and screen-reader support without script. */
export function Faq() {
  const t = useTranslations('Home.faq');
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8 lg:py-32">
        <h2 id="faq-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('title')}
        </h2>
        <div className="divide-y divide-border border-y border-border">
          {KEYS.map((key) => (
            <details key={key} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-start text-base font-medium text-fg [&::-webkit-details-marker]:hidden">
                {t(`items.${key}.q`)}
                <Plus
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden
                  className="shrink-0 text-fg-muted transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <p className="max-w-2xl pb-6 text-base leading-relaxed text-fg-muted">{t(`items.${key}.a`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
