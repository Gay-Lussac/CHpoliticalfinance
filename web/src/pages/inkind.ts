// In-kind support (services, goods) declared for one vote or election: who gave what, to whom, worth how much.
import { get } from '../api';
import { chf, esc } from '../format';
import { lang, T, type Lang } from '../i18n';
import { href } from '../router';

interface Row { donor_id: number | null; donor_name: string | null; donor_type: string; is_anonymous: boolean; suppressed?: boolean;
  actor_id: number; actor_name: string; stance: string; service_type: string | null; description: string | null; value: number }

const TEXT: Record<Lang, { title: string; lead: (n: number, total: string) => string; given_by: string; to: string; what: string;
  value: string; note: string; services: string; goods: string; masked: string; anonymous: string; more: (n: number) => string }> = {
  fr: { title: 'Soutien en nature', lead: (n, v) => `${n} ${n > 1 ? 'prestations ou livraisons' : 'prestation ou livraison'} d'une valeur totale de ${v} : du travail, des annonces ou du matériel fournis plutôt que de l'argent.`,
    given_by: 'Fourni par', to: 'À', what: 'Quoi', value: 'Valeur', note: 'Descriptions telles que déclarées. Valeur estimée par les déclarant·e·s ; seuls les dons de plus de 15 000 CHF sont nommés.',
    services: 'Prestation de services', goods: 'Livraison de biens', masked: 'Donateur masqué', anonymous: 'Non nominatif', more: (n) => `Afficher les ${n} autres` },
  de: { title: 'Sachleistungen', lead: (n, v) => `${n} ${n > 1 ? 'Dienst- oder Sachleistungen' : 'Dienst- oder Sachleistung'} im Gesamtwert von ${v}: Arbeit, Inserate oder Material statt Geld.`,
    given_by: 'Geleistet von', to: 'An', what: 'Was', value: 'Wert', note: 'Beschreibungen wie deklariert. Wert von den Deklarierenden geschätzt; nur Zuwendungen über 15 000 CHF sind namentlich.',
    services: 'Dienstleistung', goods: 'Warenlieferung', masked: 'Maskierte Person', anonymous: 'Nicht namentlich', more: (n) => `Die ${n} weiteren anzeigen` },
  it: { title: 'Sostegno in natura', lead: (n, v) => `${n} ${n > 1 ? 'prestazioni o forniture' : 'prestazione o fornitura'} per un valore totale di ${v}: lavoro, annunci o materiale invece di denaro.`,
    given_by: 'Fornito da', to: 'A', what: 'Cosa', value: 'Valore', note: 'Descrizioni come dichiarate. Valore stimato da chi dichiara; solo le liberalità superiori a 15 000 CHF sono nominate.',
    services: 'Prestazione di servizi', goods: 'Fornitura di beni', masked: 'Persona mascherata', anonymous: 'Non nominativo', more: (n) => `Mostra gli altri ${n}` },
  en: { title: 'In-kind support', lead: (n, v) => `${n} ${n > 1 ? 'services or deliveries' : 'service or delivery'} worth ${v} in total: work, ads or material given instead of money.`,
    given_by: 'Given by', to: 'To', what: 'What', value: 'Value', note: 'Descriptions as declared. Value estimated by the declarants; only donations over CHF 15,000 are named.',
    services: 'Services', goods: 'Goods', masked: 'Masked donor', anonymous: 'Unnamed', more: (n) => `Show the other ${n}` },
};

const FIRST = 10;

/** Appends the in-kind card to `container`; nothing when the vote or election has no declared in-kind support. */
export async function inkindCard(container: HTMLElement, financingId: number) {
  const rows = await get<Row[]>('inkind', { financing_id: financingId }).catch(() => [] as Row[]);
  if (!rows.length) return;
  const m = TEXT[lang()];
  const t = T();
  const kind = (s: string | null) => (s === 'Livraison de biens' ? m.goods : s === 'Prestation de services' ? m.services : s ?? '');
  const donor = (r: Row) => (r.suppressed ? esc(m.masked) : r.donor_id ? `<a href="${href(`donor/${r.donor_id}`)}">${esc(r.donor_name ?? '')}</a>`
    : esc(r.is_anonymous ? m.anonymous : r.donor_name ?? m.anonymous));
  const side = (r: Row) => (r.stance === 'for' ? ` <span class="badge"><i class="dot yes"></i>${esc(t.for)}</span>`
    : r.stance === 'against' ? ` <span class="badge"><i class="dot no"></i>${esc(t.against)}</span>` : '');
  const row = (r: Row) => `<tr>
      <td>${donor(r)}<div class="m-only muted small"><span>→ <a href="${href(`actor/${r.actor_id}`)}">${esc(r.actor_name)}</a></span><span>${esc(r.description ?? kind(r.service_type))}</span></div></td>
      <td><a href="${href(`actor/${r.actor_id}`)}">${esc(r.actor_name)}</a>${side(r)}</td>
      <td>${esc(r.description ?? '')} <span class="muted small">(${esc(kind(r.service_type))})</span></td>
      <td><span class="num">${chf(r.value)}</span></td></tr>`;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const section = document.createElement('section');
  section.className = 'card m-compact';
  section.innerHTML = `<h2>${esc(m.title)}</h2><p>${esc(m.lead(rows.length, chf(total)))}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>${esc(m.given_by)}</th><th>${esc(m.to)}</th><th>${esc(m.what)}</th><th>${esc(m.value)}</th></tr></thead>
      <tbody>${rows.slice(0, FIRST).map(row).join('')}</tbody></table></div>
    ${rows.length > FIRST ? `<p class="cand-foot"><button type="button" class="more-btn">${esc(m.more(rows.length - FIRST))}</button></p>` : ''}
    <p class="muted small">${esc(m.note)}</p>`;
  section.querySelector('.more-btn')?.addEventListener('click', (e) => {
    section.querySelector('tbody')!.insertAdjacentHTML('beforeend', rows.slice(FIRST).map(row).join(''));
    (e.target as HTMLElement).parentElement!.remove();
  });
  container.append(section);
}
