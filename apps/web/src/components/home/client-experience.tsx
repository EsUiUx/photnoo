import { Check, Download } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import p1 from '../../../public/photos/engagement-citadel-1.jpg';
import p2 from '../../../public/photos/engagement-citadel-2.jpg';
import p3 from '../../../public/photos/engagement-citadel-3.jpg';
import p4 from '../../../public/photos/engagement-citadel-4.jpg';
import cover from '../../../public/photos/couple-bw-laugh.jpg';

/** What the client sees: a phone-sized gallery built from the same components the product uses. */
export function ClientExperience() {
  const t = useTranslations('Home.clients');
  const points = ['noApp', 'fullscreen', 'download', 'languages'] as const;
  return (
    <section id="clients" aria-labelledby="clients-title" className="scroll-mt-20 overflow-hidden bg-canvas">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-32">
        <div className="order-2 flex justify-center lg:order-1">
          <Phone t={t} />
        </div>
        <div className="order-1 lg:order-2">
          <h2 id="clients-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-fg-muted">{t('body')}</p>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map((key) => (
              <li key={key} className="flex items-start gap-3 text-base text-fg-secondary">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Check size={14} strokeWidth={2.5} aria-hidden />
                </span>
                {t(`points.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Phone({ t }: { t: ReturnType<typeof useTranslations<'Home.clients'>> }) {
  const grid = [p1, p2, p3, p4];
  return (
    <figure className="relative w-[300px] shrink-0 sm:w-[320px]">
      <div aria-hidden className="absolute -inset-16 -z-10 rounded-full bg-brand-soft/70 blur-3xl" />
      <div className="rounded-[44px] border-[10px] border-primary-900 bg-primary-900 shadow-overlay">
        <div className="relative overflow-hidden rounded-[34px] bg-surface">
          <div className="relative h-56">
            <Image src={cover} alt={t('phoneAlt')} fill sizes="320px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="text-lg font-semibold">{t('demoGallery')}</p>
              <p className="text-xs text-white/80">{t('demoMeta')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full w-[62%] rounded-full bg-brand" />
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-brand-fg">
              <Download size={14} strokeWidth={2} aria-hidden />
              {t('downloadAll')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {grid.map((src, i) => (
              <Image key={i} src={src} alt="" sizes="160px" className="aspect-[4/5] w-full rounded-sm object-cover" />
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
