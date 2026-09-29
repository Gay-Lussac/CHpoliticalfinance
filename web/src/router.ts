// Minimal history router: /{lang}/{page}/{id}?query
import { lang } from './i18n';

export interface Route { lang: string; page: string; id?: string; params: URLSearchParams }

export const href = (path: string) => `/${lang()}/${path.replace(/^\//, '')}`;

export function parseLocation(): Route {
  const parts = location.pathname.split('/').filter(Boolean);
  return { lang: parts[0] ?? '', page: parts[1] ?? '', id: parts[2], params: new URLSearchParams(location.search) };
}

type Handler = () => void;
let onChange: Handler = () => {};

export function startRouter(handler: Handler) {
  onChange = handler;
  window.addEventListener('popstate', () => onChange());
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
  onChange();
}

export function navigate(url: string, replace = false) {
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  onChange();
  if (!replace) window.scrollTo(0, 0);
}
