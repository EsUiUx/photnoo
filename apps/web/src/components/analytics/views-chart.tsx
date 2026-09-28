'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { AnalyticsTimeseries, TimeseriesPoint } from '@/lib/types-insights';

/**
 * Series colors, validated with the dataviz palette checker on the white surface (lightness band,
 * chroma floor, CVD separation 11.0, normal-vision 22.0, contrast >= 3:1). The brand green reads
 * too gray for a data mark, so views use a deeper, more saturated green. Theme tokens win when
 * the design system defines them.
 */
export const SERIES = {
  views: 'var(--color-chart-1, #2d6e3e)',
  downloads: 'var(--color-chart-2, #c07a1a)',
} as const;

const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };
/** Room for the end-of-line series names on wide charts. */
const LABEL_ROOM = 84;

function niceMax(max: number): { top: number; step: number } {
  if (max <= 4) return { top: 4, step: 1 };
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
  return { top: Math.ceil(max / step) * step, step };
}

const parse = (date: string) => new Date(`${date}T00:00:00Z`);

/** Line draw-in: dash offset eases from hidden to drawn; reduced motion shows the line at once. */
const DRAW = 'transition-[stroke-dashoffset] duration-[900ms] ease-[var(--ease-out-expo)] motion-reduce:transition-none';

/**
 * Two-line chart (one shared count axis) with an area under views, a crosshair tooltip on
 * hover or arrow keys, a legend, and a table for screen readers.
 */
export function ViewsChart({ data }: { data: AnalyticsTimeseries }) {
  const t = useTranslations('App.analytics');
  const format = useFormatter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  // The lines draw in once, left to right, when the chart first appears; later data just swaps.
  const [drawn, setDrawn] = useState(false);
  const titleId = useId();
  const tableId = useId();
  // A plain id: url(#…) references do not tolerate the punctuation useId may produce.
  const maskId = `draw${useId().replace(/[^\w-]/g, '')}`;
  const points = data.points;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry!.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let second = 0;
    // Two frames, so the undrawn state is painted before the transition starts.
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  const number = (n: number) => format.number(n, { numberingSystem: 'latn' });
  const label = (date: string, long = false) => {
    const d = parse(date);
    if (data.unit === 'month') return format.dateTime(d, { month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' });
    const day = format.dateTime(d, { day: 'numeric', month: 'short', ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' });
    return data.unit === 'week' && long ? t('weekOf', { date: day }) : day;
  };

  const max = Math.max(0, ...points.map((p) => Math.max(p.views, p.downloads)));
  const { top, step } = niceMax(max);
  const endLabels = width >= 480;
  const right = PAD.right + (endLabels ? LABEL_ROOM : 0);
  const innerW = width - PAD.left - right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

  const line = (key: keyof Omit<TimeseriesPoint, 'date'>) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const viewsLine = line('views');
  const paths = {
    views: viewsLine,
    downloads: line('downloads'),
    area: points.length ? `${viewsLine}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : '',
  };

  // About six date labels, always including the last bucket.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 90))));
  const ticks = points.map((p, i) => ({ i, p })).filter(({ i }) => (points.length - 1 - i) % every === 0);
  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step);

  function pick(clientX: number) {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  }

  function onKey(event: React.KeyboardEvent) {
    if (!points.length) return;
    const current = active ?? points.length - 1;
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(points.length - 1, current + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, current - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = points.length - 1;
    else if (event.key === 'Escape') return setActive(null);
    else return;
    event.preventDefault();
    setActive(next);
  }

  const totals = points.reduce((s, p) => ({ views: s.views + p.views, downloads: s.downloads + p.downloads }), { views: 0, downloads: 0 });
  const point = active !== null ? points[active] : null;
  const tipLeft = active !== null ? (x(active) / width) * 100 : 0;

  // End-of-line labels beside the last points, pushed at least 16px apart.
  const last = points[points.length - 1];
  let endViews = last ? y(last.views) : 0;
  let endDownloads = last ? y(last.downloads) : 0;
  if (Math.abs(endViews - endDownloads) < 16) {
    const mid = (endViews + endDownloads) / 2;
    const viewsAbove = last ? last.views >= last.downloads : true;
    endViews = mid + (viewsAbove ? -8 : 8);
    endDownloads = mid + (viewsAbove ? 8 : -8);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-secondary">
        <Legend color={SERIES.views} label={t('views')} value={number(totals.views)} />
        <Legend color={SERIES.downloads} label={t('downloads')} value={number(totals.downloads)} dashed />
      </div>

      <div
        ref={wrapRef}
        dir="ltr"
        className="relative mt-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand"
        tabIndex={0}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={tableId}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <span id={titleId} className="sr-only">
          {t('chartSummary', { views: number(totals.views), downloads: number(totals.downloads) })}
        </span>
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden className="block max-w-full touch-pan-y select-none">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - right} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} strokeDasharray={v === 0 ? undefined : '2 4'} />
              <text x={PAD.left - 10} y={y(v)} dy="0.32em" textAnchor="end" className="fill-fg-muted text-xs tabular">
                {number(v)}
              </text>
            </g>
          ))}
          {ticks.map(({ i, p }) => (
            <text key={p.date} x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'} className="fill-fg-muted text-xs">
              {label(p.date)}
            </text>
          ))}

          {/* The dashed downloads line is revealed through a solid copy of itself that draws in. */}
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={HEIGHT}>
              <path
                d={paths.downloads}
                pathLength={1}
                fill="none"
                stroke="white"
                strokeWidth={6}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="1 1"
                className={cn(DRAW, drawn ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]')}
              />
            </mask>
          </defs>
          <path
            d={paths.area}
            fill={SERIES.views}
            className={cn('transition-opacity delay-300 duration-500 ease-[var(--ease-out-expo)] motion-reduce:delay-0', drawn ? 'opacity-[0.08]' : 'opacity-0')}
          />
          <path
            d={paths.views}
            pathLength={1}
            fill="none"
            stroke={SERIES.views}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="1 1"
            className={cn(DRAW, drawn ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]')}
          />
          <path
            d={paths.downloads}
            fill="none"
            stroke={SERIES.downloads}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="6 4"
            mask={`url(#${maskId})`}
          />

          {last && endLabels ? (
            <g className={cn('transition-opacity delay-700 duration-300 motion-reduce:delay-0', drawn ? 'opacity-100' : 'opacity-0')}>
              <circle cx={x(points.length - 1)} cy={y(last.views)} r={3.5} fill={SERIES.views} className="stroke-surface" strokeWidth={2} />
              <circle cx={x(points.length - 1)} cy={y(last.downloads)} r={3.5} fill={SERIES.downloads} className="stroke-surface" strokeWidth={2} />
            </g>
          ) : null}

          {point && active !== null ? (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-fg-muted" strokeWidth={1} />
              <circle cx={x(active)} cy={y(point.views)} r={5} fill={SERIES.views} className="stroke-surface" strokeWidth={2} />
              <circle cx={x(active)} cy={y(point.downloads)} r={5} fill={SERIES.downloads} className="stroke-surface" strokeWidth={2} />
            </g>
          ) : null}
        </svg>

        {point ? (
          <div
            aria-live="polite"
            className={cn(
              'pointer-events-none absolute top-2 z-10 min-w-44 rounded-md whitespace-nowrap border border-border bg-surface px-3 py-2 text-sm shadow-popover',
              tipLeft > 60 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
            )}
            style={{ left: `${tipLeft}%` }}
          >
            <p className="font-medium text-fg" dir="auto">
              {label(point.date, true)}
            </p>
            <TipRow color={SERIES.views} label={t('seriesViews')} value={number(point.views)} />
            <TipRow color={SERIES.downloads} label={t('downloads')} value={number(point.downloads)} dashed />
          </div>
        ) : null}
      </div>

      {/* sr-only on the wrapper: tables ignore the 1px box and would widen the page. */}
      <div className="sr-only">
      <table id={tableId}>
        <caption>{t('tableCaption', { unit: data.unit })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('tableDate', { unit: data.unit })}</th>
            <th scope="col">{t('views')}</th>
            <th scope="col">{t('downloads')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{label(p.date, true)}</th>
              <td>{number(p.views)}</td>
              <td>{number(p.downloads)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="18" height="8" aria-hidden className="shrink-0">
      <line x1="1" x2="17" y1="4" y2="4" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
  );
}

function Legend({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Swatch color={color} dashed={dashed} />
      <span>{label}</span>
      <span className="tabular font-semibold text-fg">{value}</span>
    </span>
  );
}

function TipRow({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-fg-secondary">
      <Swatch color={color} dashed={dashed} />
      <span className="flex-1">{label}</span>
      <span className="tabular font-semibold text-fg">{value}</span>
    </p>
  );
}
