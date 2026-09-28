'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PortfolioRules } from '@photnoo/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { useUpdatePortfolioItem } from '@/lib/queries-insights';
import type { PortfolioItem } from '@/lib/types-insights';
import { PORTFOLIO_CATEGORIES, presetOf } from './categories';

const OTHER = '__other';

export function EditItemDialog({ item, onClose }: { item: PortfolioItem | null; onClose: () => void }) {
  const t = useTranslations('App.portfolio');
  return (
    <Dialog open={Boolean(item)} onClose={onClose} title={t('editTitle')} size="sm">
      {item ? <EditForm key={item.id} item={item} onDone={onClose} /> : null}
    </Dialog>
  );
}

function EditForm({ item, onDone }: { item: PortfolioItem; onDone: () => void }) {
  const t = useTranslations('App.portfolio');
  const tc = useTranslations('App.portfolio.categories');
  const common = useTranslations('Common');
  const update = useUpdatePortfolioItem();
  const preset = presetOf(item.category);
  const [caption, setCaption] = useState(item.caption ?? '');
  const [choice, setChoice] = useState<string>(preset ?? (item.category ? OTHER : ''));
  const [custom, setCustom] = useState(preset ? '' : (item.category ?? ''));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const category = choice === OTHER ? custom.trim() : choice;
    try {
      await update.mutateAsync({ id: item.id, caption: caption.trim() || null, category: category || null });
      onDone();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-md bg-surface-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
        <img src={item.previewUrl} alt="" className="mx-auto max-h-48 w-auto object-contain" />
      </div>
      <TextareaField
        label={t('caption')}
        hint={t('captionHint')}
        optional
        rows={2}
        maxLength={PortfolioRules.captionMax}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <SelectField label={t('category')} value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">{t('noCategory')}</option>
        {PORTFOLIO_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {tc(c)}
          </option>
        ))}
        <option value={OTHER}>{t('categoryOther')}</option>
      </SelectField>
      {choice === OTHER ? (
        <TextField label={t('categoryCustom')} value={custom} maxLength={PortfolioRules.categoryMax} onChange={(e) => setCustom(e.target.value)} required autoFocus />
      ) : null}
      {update.isError ? <Alert>{t('saveFailed')}</Alert> : null}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onDone}>
          {common('cancel')}
        </Button>
        <Button type="submit" pending={update.isPending}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
