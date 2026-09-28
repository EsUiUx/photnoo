import Image from 'next/image';
import { useTranslations } from 'next-intl';

const PHOTOS = [
  { src: '/home/why-5.jpg', width: 1200, height: 800, rotate: -4.66, className: 'w-[46%] sm:w-[30%]' },
  { src: '/home/why-2.jpg', width: 1000, height: 667, rotate: 0, className: 'hidden sm:block sm:w-[22.6%] sm:mt-2' },
  { src: '/home/why-1.jpg', width: 1200, height: 800, rotate: 6.31, className: 'w-[46%] sm:w-[27.9%]' },
];

/** Figma "Frame 1618872849": polaroids overlapping the section edge, big "Why" + wordmark. */
export function WhySection() {
  const t = useTranslations('Why');
  return (
    <section className="relative bg-primary-200 pb-20 lg:pb-28">
      <div className="mx-auto -mt-28 flex max-w-[1920px] items-start justify-between gap-4 px-4 sm:px-8 lg:-mt-[280px] xl:px-[2.7%]">
        {PHOTOS.map((photo) => (
          <div
            key={photo.src}
            className={`border border-[#e9e9e9] bg-white p-[3.9%] pb-[12%] shadow-[0_4px_20px_rgba(0,0,0,0.1)] sm:p-[1.2%] sm:pb-[4%] ${photo.className}`}
            style={{ transform: `rotate(${photo.rotate}deg)` }}
          >
            <Image
              src={photo.src}
              alt=""
              width={photo.width}
              height={photo.height}
              sizes="(min-width: 640px) 30vw, 46vw"
              className="aspect-[1.08] h-auto w-full object-cover"
            />
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-[1548px] flex-col items-center px-4 text-center sm:px-8 lg:mt-8">
        <h2 className="flex flex-col items-center">
          <span className="text-[96px] leading-none font-semibold text-primary-300 sm:text-[140px] xl:text-[200px]">{t('title')}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark */}
          <img src="/home/why-logo.svg" alt="Photnoo" width={937} height={170} className="mt-4 h-auto w-[78%] max-w-[937px]" />
        </h2>
        <p className="mt-12 text-lg font-semibold text-primary-400 lg:mt-16 lg:text-[25px]">{t('body')}</p>
      </div>
    </section>
  );
}
