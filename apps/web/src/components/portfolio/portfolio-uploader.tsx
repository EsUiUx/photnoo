'use client';

import { AlertCircle, CheckCircle2, ImagePlus, RotateCcw, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { Alert, Spinner } from '@/components/ui/state';
import { Meter } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useUploadPortfolioItem } from '@/lib/queries-insights';
import { PORTFOLIO_CATEGORIES } from './categories';

const MAX_BYTES = 15 * 1024 * 1024;

type Status = 'waiting' | 'uploading' | 'done' | 'failed';
type ErrorKey = 'errorType' | 'errorSize' | 'errorFull' | 'errorGeneric';
type Entry = { key: string; file: File; status: Status; error?: ErrorKey; category: string };

function precheck(file: File): ErrorKey | null {
  const typeOk = ['image/jpeg', 'image/png'].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
  if (!typeOk) return 'errorType';
  if (file.size > MAX_BYTES) return 'errorSize';
  return null;
}

function errorKey(error: unknown): ErrorKey {
  if (error instanceof ApiError) {
    if (error.code === 'image_type' || error.code === 'image_unreadable') return 'errorType';
    if (error.code === 'image_too_large' || error.status === 413) return 'errorSize';
    if (error.code === 'portfolio_full') return 'errorFull';
  }
  return 'errorGeneric';
}

/**
 * Multi-file drop zone. Files upload one at a time (one image per request) so a slow phone
 * connection never runs several 15 MB uploads at once; each row reports its own result.
 */
export function PortfolioUploader({ remaining, max }: { remaining: number; max: number }) {
  const t = useTranslations('App.portfolio');
  const tc = useTranslations('App.portfolio.categories');
  const upload = useUploadPortfolioItem();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState('');
  const running = useRef(false);
  const queueRef = useRef(queue);
  const capacity = useRef(remaining);
  const hintId = useId();

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    capacity.current = remaining;
  }, [remaining]);

  const patch = (key: string, next: Partial<Entry>) => setQueue((q) => q.map((e) => (e.key === key ? { ...e, ...next } : e)));

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = queueRef.current.find((e) => e.status === 'waiting');
        if (!next) break;
        if (capacity.current <= 0) {
          patch(next.key, { status: 'failed', error: 'errorFull' });
          queueRef.current = queueRef.current.map((e) => (e.key === next.key ? { ...e, status: 'failed' } : e));
          continue;
        }
        patch(next.key, { status: 'uploading' });
        queueRef.current = queueRef.current.map((e) => (e.key === next.key ? { ...e, status: 'uploading' } : e));
        let result: Partial<Entry>;
        try {
          await upload.mutateAsync({ file: next.file, category: next.category || undefined });
          capacity.current -= 1;
          result = { status: 'done' };
        } catch (error) {
          result = { status: 'failed', error: errorKey(error) };
        }
        patch(next.key, result);
        queueRef.current = queueRef.current.map((e) => (e.key === next.key ? { ...e, ...result } : e));
      }
    } finally {
      running.current = false;
    }
  }, [upload]);

  function add(files: FileList | File[]) {
    const entries: Entry[] = Array.from(files).map((file) => {
      const error = precheck(file);
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        category,
        status: error ? 'failed' : 'waiting',
        error: error ?? undefined,
      };
    });
    if (entries.length === 0) return;
    // A new batch after the last one finished starts a fresh list; during uploads it queues up.
    const active = queueRef.current.some((e) => e.status === 'waiting' || e.status === 'uploading');
    queueRef.current = [...(active ? queueRef.current : []), ...entries];
    setQueue(queueRef.current);
    void run();
  }

  function retry() {
    queueRef.current = queueRef.current.map((e) =>
      e.status === 'failed' && e.error !== 'errorType' && e.error !== 'errorSize' ? { ...e, status: 'waiting', error: undefined } : e,
    );
    setQueue(queueRef.current);
    void run();
  }

  function clear() {
    queueRef.current = queueRef.current.filter((e) => e.status === 'waiting' || e.status === 'uploading');
    setQueue(queueRef.current);
  }

  const total = queue.length;
  const finished = queue.filter((e) => e.status === 'done' || e.status === 'failed').length;
  const done = queue.filter((e) => e.status === 'done').length;
  const failed = queue.filter((e) => e.status === 'failed');
  const busy = queue.some((e) => e.status === 'waiting' || e.status === 'uploading');
  const retryable = failed.some((e) => e.error !== 'errorType' && e.error !== 'errorSize');
  const full = remaining <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = full ? 'none' : 'copy';
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setDragging(false);
          if (!full) add(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-150 sm:flex-row sm:text-start',
          dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-subtle',
        )}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <ImagePlus size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-fg">{dragging ? t('dropActive') : t('dropTitle')}</p>
          <p id={hintId} className="mt-1 text-sm text-fg-muted">
            {t('dropBody')}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          <SelectField label={t('uploadCategory')} value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48">
            <option value="">{t('noCategory')}</option>
            {PORTFOLIO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tc(c)}
              </option>
            ))}
          </SelectField>
          <Button icon={Upload} onClick={() => inputRef.current?.click()} disabled={full} aria-describedby={hintId}>
            {t('chooseFiles')}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {full ? <Alert tone="warning">{t('full', { max })}</Alert> : null}

      {total > 0 ? (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-fg" aria-live="polite">
              {busy ? t('queueTitle', { done: Math.min(finished + 1, total), total }) : t('queueDone', { count: done })}
              {!busy && failed.length ? <span className="ms-2 text-danger">{t('queueFailedCount', { count: failed.length })}</span> : null}
            </p>
            <div className="flex gap-2">
              {!busy && retryable ? (
                <Button size="sm" variant="secondary" icon={RotateCcw} onClick={retry}>
                  {t('queueRetry')}
                </Button>
              ) : null}
              {!busy ? (
                <Button size="sm" variant="ghost" onClick={clear}>
                  {t('queueClear')}
                </Button>
              ) : null}
            </div>
          </div>
          <Meter value={(finished / total) * 100} label={t('queueProgress')} size="sm" className="mt-3" />
          <ul className="mt-3 max-h-56 divide-y divide-border overflow-y-auto">
            {queue.map((entry) => (
              <li key={entry.key} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-fg-secondary" dir="auto">
                  {entry.file.name}
                </span>
                <QueueStatus entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QueueStatus({ entry }: { entry: Entry }) {
  const t = useTranslations('App.portfolio');
  if (entry.status === 'uploading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-fg-muted">
        <Spinner size={16} />
        {t('queueUploading')}
      </span>
    );
  }
  if (entry.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
        {t('queueAdded')}
      </span>
    );
  }
  if (entry.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-danger">
        <AlertCircle size={16} strokeWidth={1.75} aria-hidden />
        {t(entry.error ?? 'errorGeneric')}
      </span>
    );
  }
  return <span className="text-fg-muted">{t('queueWaiting')}</span>;
}
