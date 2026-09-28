import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { Link } from '@/i18n/navigation';

type Props = { params: Promise<{ locale: string }> };

export default function HomePage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();
  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  const steps = [
    { title: t('Steps.upload'), body: t('Steps.uploadBody') },
    { title: t('Steps.send'), body: t('Steps.sendBody') },
    { title: t('Steps.proof'), body: t('Steps.proofBody') },
  ];

  return (
    <main>
      <header className="bg-primary-500 text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <span className="text-xl font-semibold tracking-wide">PHOTNOO</span>
          <div className="flex items-center gap-3 text-sm sm:gap-6">
            <Link href="/" locale={otherLocale} className="opacity-80 hover:opacity-100">
              {t('Nav.language')}
            </Link>
            <Link href="/login" className="hidden opacity-80 hover:opacity-100 sm:inline">
              {t('Nav.login')}
            </Link>
            <Link
              href="/apply"
              className="rounded-full bg-white px-4 py-2 font-medium text-primary-600 hover:bg-primary-100"
            >
              {t('Nav.apply')}
            </Link>
          </div>
        </nav>
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            {t('Home.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-100">{t('Home.subtitle')}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/apply"
              className="rounded-full bg-white px-6 py-3 font-medium text-primary-600 hover:bg-primary-100"
            >
              {t('Home.primaryCta')}
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-white/40 px-6 py-3 font-medium hover:bg-white/10"
            >
              {t('Home.secondaryCta')}
            </Link>
          </div>
          <p className="mt-6 text-sm text-primary-200">{t('Home.invite')}</p>
        </section>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold">{t('Steps.title')}</h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-card border border-line bg-primary-50 p-6">
              <span className="text-sm font-medium text-primary-300">0{index + 1}</span>
              <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
