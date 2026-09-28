import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { messageFiles } from './messages';

type Tree = Record<string, unknown>;

function merge(target: Tree, source: Tree): Tree {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    target[key] =
      existing && typeof existing === 'object' && value && typeof value === 'object'
        ? merge({ ...(existing as Tree) }, value as Tree)
        : value;
  }
  return target;
}

/**
 * Messages live in one file per area (messages/<locale>/*.json), each holding a slice of the
 * namespace tree such as {"App": {"billing": {...}}}. They are deep-merged here, so areas can
 * be edited independently without touching a single giant file.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const parts = await Promise.all(
    messageFiles.map(async (name) => (await import(`../../messages/${locale}/${name}.json`)).default as Tree),
  );
  return {
    locale,
    messages: parts.reduce<Tree>((all, part) => merge(all, part), {}),
    timeZone: 'Africa/Cairo',
  };
});
