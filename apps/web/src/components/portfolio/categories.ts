import { PORTFOLIO_CATEGORIES } from '@photnoo/shared';

export type PresetCategory = (typeof PORTFOLIO_CATEGORIES)[number];

/** Preset categories are stored as their key ("wedding") and translated when shown; free text is shown as typed. */
export function presetOf(value: string | null | undefined): PresetCategory | null {
  const key = value?.trim().toLowerCase();
  return key && (PORTFOLIO_CATEGORIES as readonly string[]).includes(key) ? (key as PresetCategory) : null;
}

export function categoryLabel(value: string, translate: (key: PresetCategory) => string): string {
  const preset = presetOf(value);
  return preset ? translate(preset) : value;
}

export { PORTFOLIO_CATEGORIES };
