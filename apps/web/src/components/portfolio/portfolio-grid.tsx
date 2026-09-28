'use client';

import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Menu } from '@/components/ui/menu';
import { Alert } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { useDeletePortfolioItem, useReorderPortfolio } from '@/lib/queries-insights';
import type { PortfolioItem } from '@/lib/types-insights';
import { categoryLabel } from './categories';
import { EditItemDialog } from './edit-item-dialog';

// Controls stay visible on touch screens and while a tile holds focus.
const REVEAL = 'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100';

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item!);
  return next;
}

const ratioOf = (item: PortfolioItem) => (item.width && item.height ? item.width / item.height : 1.5);

/**
 * Justified rows (every image keeps its shape, rows share one height) in reading order, so the
 * order on screen is the order on the public page. Reorder by dragging with a mouse, with the
 * move handle and the keyboard, or from each image's menu (touch).
 */
export function PortfolioGrid({ items }: { items: PortfolioItem[] }) {
  const t = useTranslations('App.portfolio');
  const tc = useTranslations('App.portfolio.categories');
  const reorder = useReorderPortfolio();
  const remove = useDeletePortfolioItem();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; origin: string[] } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const focusAfter = useRef<string | null>(null);
  const instructionsId = useId();

  const byId = new Map(items.map((i) => [i.id, i]));
  const order = (draft ?? items.map((i) => i.id)).filter((id) => byId.has(id));
  const known = new Set(order);
  const shown = [...order, ...items.filter((i) => !known.has(i.id)).map((i) => i.id)].map((id) => byId.get(id)!);
  const total = shown.length;

  useEffect(() => {
    if (!focusAfter.current) return;
    handles.current.get(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  function commit(ids: string[]) {
    setDraft(null);
    setError(null);
    const current = items.map((i) => i.id);
    if (ids.length === current.length && ids.every((id, i) => id === current[i])) return;
    reorder.mutate(ids, { onError: () => setError(t('reorderFailed')) });
  }

  function moveTo(id: string, to: number) {
    const ids = shown.map((i) => i.id);
    commit(move(ids, ids.indexOf(id), to));
  }

  function onHandleKey(event: React.KeyboardEvent, id: string) {
    const ids = shown.map((i) => i.id);
    const index = ids.indexOf(id);
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!picked) {
        setPicked({ id, origin: ids });
        setDraft(ids);
        setAnnouncement(t('picked', { position: index + 1, total }));
      } else {
        setPicked(null);
        commit(ids);
        setAnnouncement(t('dropped', { position: index + 1, total }));
      }
      return;
    }
    if (!picked || picked.id !== id) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setPicked(null);
      setDraft(null);
      focusAfter.current = id;
      setAnnouncement(t('cancelled'));
      return;
    }
    const rtl = document.documentElement.dir === 'rtl';
    const later = ['ArrowDown', rtl ? 'ArrowLeft' : 'ArrowRight'];
    const earlier = ['ArrowUp', rtl ? 'ArrowRight' : 'ArrowLeft'];
    let to = index;
    if (later.includes(event.key)) to = Math.min(total - 1, index + 1);
    else if (earlier.includes(event.key)) to = Math.max(0, index - 1);
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = total - 1;
    else return;
    event.preventDefault();
    if (to === index) return;
    setDraft(move(ids, index, to));
    focusAfter.current = id;
    setAnnouncement(t('moved', { position: to + 1, total }));
  }

  async function onDelete(item: PortfolioItem) {
    const ok = await confirm({ title: t('deleteTitle'), body: t('deleteBody'), confirmLabel: t('deleteConfirm') });
    if (!ok) return;
    setError(null);
    remove.mutate(item.id, { onError: () => setError(t('deleteFailed')) });
  }

  return (
    <>
      {error ? <Alert className="mb-4">{error}</Alert> : null}
      <p id={instructionsId} className="sr-only">
        {t('moveInstructions')}
      </p>
      <p aria-live="assertive" className="sr-only">
        {announcement}
      </p>
      <ul aria-label={t('gridLabel')} className="flex flex-wrap gap-2 [--row-h:7rem] sm:gap-3 sm:[--row-h:10rem] lg:[--row-h:12rem]">
        {shown.map((item, index) => {
          const ratio = ratioOf(item);
          const name = item.caption || t('imageName', { position: index + 1 });
          const isPicked = picked?.id === item.id;
          return (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => {
                setDragId(item.id);
                setDraft(shown.map((i) => i.id));
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (dragId === item.id) return;
                const ids = shown.map((i) => i.id);
                const rect = e.currentTarget.getBoundingClientRect();
                const rtl = document.documentElement.dir === 'rtl';
                const after = rtl ? e.clientX < rect.left + rect.width / 2 : e.clientX > rect.left + rect.width / 2;
                const from = ids.indexOf(dragId);
                let to = ids.indexOf(item.id) + (after ? 1 : 0);
                if (from < to) to -= 1;
                if (from !== to) setDraft(move(ids, from, to));
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={() => {
                setDragId(null);
                commit(shown.map((i) => i.id));
              }}
              style={{ flexGrow: ratio, flexBasis: `calc(var(--row-h) * ${ratio.toFixed(3)})` }}
              className={cn(
                'group relative min-w-0 overflow-hidden rounded-md bg-surface-sunken',
                dragId === item.id && 'opacity-40',
                isPicked && 'ring-2 ring-brand ring-offset-2 ring-offset-canvas',
              )}
            >
              <div
                className="relative w-full bg-cover bg-center"
                style={{ aspectRatio: ratio, backgroundImage: item.blurDataUrl ? `url(${item.blurDataUrl})` : undefined }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                <img
                  src={item.previewUrl}
                  alt={item.caption ?? ''}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  className="absolute inset-0 size-full object-cover"
                />
              </div>

              {item.caption || item.category ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-2.5">
                  {item.category ? (
                    <span className="inline-flex h-6 items-center rounded-full bg-white/90 px-2.5 text-xs font-medium text-fg">
                      {categoryLabel(item.category, (key) => tc(key))}
                    </span>
                  ) : null}
                  {item.caption ? (
                    <p className="mt-1 truncate text-sm text-white" dir="auto">
                      {item.caption}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className={cn('absolute end-2 top-2 flex gap-1.5', isPicked ? 'opacity-100' : REVEAL)}>
                <IconButton
                  ref={(el) => {
                    if (el) handles.current.set(item.id, el);
                    else handles.current.delete(item.id);
                  }}
                  icon={GripVertical}
                  label={t('moveHandle', { name })}
                  variant="inverse"
                  size="sm"
                  aria-describedby={instructionsId}
                  aria-pressed={isPicked}
                  onKeyDown={(e) => onHandleKey(e, item.id)}
                  onBlur={() => {
                    if (picked?.id === item.id && !focusAfter.current) {
                      setPicked(null);
                      commit(shown.map((i) => i.id));
                    }
                  }}
                  className="cursor-grab"
                />
                <Menu
                  label={t('actions', { name })}
                  items={[
                    { label: t('edit'), icon: Pencil, onSelect: () => setEditing(item) },
                    { type: 'separator' },
                    { label: t('moveFirst'), icon: ArrowUpToLine, onSelect: () => moveTo(item.id, 0), disabled: index === 0 },
                    { label: t('moveEarlier'), icon: ArrowUp, onSelect: () => moveTo(item.id, index - 1), disabled: index === 0 },
                    { label: t('moveLater'), icon: ArrowDown, onSelect: () => moveTo(item.id, index + 1), disabled: index === total - 1 },
                    { label: t('moveLast'), icon: ArrowDownToLine, onSelect: () => moveTo(item.id, total - 1), disabled: index === total - 1 },
                    { type: 'separator' },
                    { label: t('delete'), icon: Trash2, tone: 'danger', onSelect: () => void onDelete(item) },
                  ]}
                  trigger={(props) => (
                    <button
                      type="button"
                      {...props}
                      className="inline-flex size-9 items-center justify-center rounded-md bg-black/35 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-black/55 pointer-coarse:size-11"
                    >
                      <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden />
                    </button>
                  )}
                />
              </div>
            </li>
          );
        })}
        {/* Soaks up the spare width so the last row keeps its natural height. */}
        <li aria-hidden className="h-0 grow-[999]" />
      </ul>
      <EditItemDialog item={editing} onClose={() => setEditing(null)} />
      {dialog}
    </>
  );
}
