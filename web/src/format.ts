import { locale } from './i18n';

/** CHF 1 234 567 (full) */
export const chf = (v: number | null | undefined) =>
  v == null ? '—' : `CHF ${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v)}`;

/** CHF 1.2 Mio / 340 k (compact, for headlines and bar labels) */
export function chfShort(v: number | null | undefined): string {
  if (v == null) return '—';
  const a = Math.abs(v);
  const nf = (x: number, d: number) => new Intl.NumberFormat(locale(), { maximumFractionDigits: d }).format(x);
  if (a >= 1e6) return `CHF ${nf(v / 1e6, a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)} Mio`;
  if (a >= 1e3) return `CHF ${nf(v / 1e3, 0)}k`;
  return `CHF ${nf(v, 0)}`;
}

export const num = (v: number) => new Intl.NumberFormat(locale()).format(v);

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
