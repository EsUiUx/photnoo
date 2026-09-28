'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

const STEPS = ['booking', 'shoot', 'upload', 'galleryDelivery', 'clientSelection', 'feedback', 'finalDelivery', 'growth'] as const;

/**
 * Figma "Frame 2609159": alternating cards on a vertical line. A step lights up (Figma's
 * highlighted "Booking" state) once it scrolls past the middle of the screen, and stays lit.
 */
export function WorkflowTimeline() {
  const t = useTranslations('Workflow');
  const [reached, setReached] = useState(0);
  const refs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          setReached((current) => Math.max(current, index));
        }
      },
      { rootMargin: '0px 0px -45% 0px' },
    );
    refs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const fill = `${(reached / (STEPS.length - 1)) * 100}%`;

  return (
    <section id="workflow" className="relative overflow-hidden bg-primary-600 py-16 lg:py-24">
      {/* eslint-disable @next/next/no-img-element -- decorative Figma exports */}
      <img src="/home/workflow-shape-1.svg" alt="" aria-hidden="true" className="absolute start-[1.7%] top-[190px] hidden w-[94px] -rotate-[48.9deg] lg:block" />
      <img src="/home/workflow-shape-2.svg" alt="" aria-hidden="true" className="absolute start-[5.2%] top-[205px] hidden w-[132px] rotate-[15.9deg] lg:block" />
      {/* eslint-enable @next/next/no-img-element */}
      <div className="relative mx-auto max-w-[1920px] px-4 sm:px-8 xl:px-[9.6%]">
        <h2 className="text-4xl font-semibold text-primary-50 lg:text-5xl">{t('title')}</h2>
        <p className="mt-6 max-w-[896px] text-lg font-medium text-neutral-400 lg:text-2xl">
          <strong className="font-bold">PHOTNOO</strong> {t('subtitle')}
        </p>

        <div className="relative mt-16 lg:mt-[120px]">
          {/* The line: white track, green progress. */}
          <div aria-hidden="true" className="absolute inset-y-0 start-[19px] w-[3px] bg-white lg:start-1/2 lg:-translate-x-1/2 rtl:lg:translate-x-1/2">
            <div className="w-full bg-primary-300 transition-[height] duration-700 ease-out motion-reduce:transition-none" style={{ height: fill }} />
          </div>

          <ol className="relative flex flex-col gap-10 lg:gap-[116px]">
            {STEPS.map((key, index) => {
              const active = index <= reached;
              const end = index % 2 === 0; // Figma starts on the end side (right in English).
              return (
                <li
                  key={key}
                  ref={(node) => {
                    refs.current[index] = node;
                  }}
                  data-index={index}
                  className="grid grid-cols-[40px_1fr] items-center gap-x-5 lg:grid-cols-[1fr_120px_1fr] lg:gap-x-0"
                >
                  <span
                    aria-hidden="true"
                    className={`col-start-1 row-start-1 size-10 rounded-full border-[5px] border-white transition-colors duration-500 lg:col-start-2 lg:justify-self-center ${
                      active ? 'bg-primary-300' : 'bg-neutral-500'
                    }`}
                  />
                  <div className={`col-start-2 row-start-1 flex items-center ${end ? 'lg:col-start-3' : 'lg:col-start-1 lg:flex-row-reverse'}`}>
                    <span aria-hidden="true" className="hidden h-px w-[92px] shrink-0 bg-neutral-500 lg:block" />
                    <article
                      className={`relative w-full max-w-[599px] border-[3px] p-4 pt-[68px] transition-colors duration-500 lg:min-h-[194px] ${
                        active ? 'border-primary-200 bg-primary-300' : 'border-[#6c757d] bg-[rgba(244,248,245,0.13)]'
                      }`}
                    >
                      <span
                        className={`absolute start-[13px] top-[10px] flex size-[46px] items-center justify-center text-2xl font-medium ${
                          active ? 'bg-primary-600 text-white' : 'bg-[rgba(244,248,245,0.13)] text-primary-50'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <h3 className={`text-2xl font-medium lg:text-[32px] ${active ? 'text-white' : 'text-[#dee2e6]'}`}>
                        {t(`steps.${key}.title`)}
                      </h3>
                      <p className={`mt-2 text-lg font-medium lg:text-2xl ${active ? 'text-primary-200' : 'text-neutral-500'}`}>
                        {t(`steps.${key}.body`)}
                      </p>
                    </article>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
