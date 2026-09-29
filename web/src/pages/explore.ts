// Explorer: filter / group / download any whitelisted dataset. The URL holds the state.
import { get, query, type Financing, type QuerySpec } from '../api';
import { date, esc } from '../format';
import { T, tr } from '../i18n';
import { href, navigate } from '../router';
import { downloadCsv, renderTable } from '../views';

const GROUPABLE = ['financing_id', 'year', 'phase', 'stance', 'party_id', 'actor_id', 'canton', 'donor_id',
  'donor_type', 'nature', 'is_foreign', 'institution'];
const FILTERS: [string, string][] = [['fin', 'financing_id'], ['kind', 'financing_kind'], ['phase', 'phase'],
  ['stance', 'stance'], ['party', 'party_id'], ['year', 'year']];

export async function explorePage(main: HTMLElement, _id: string | undefined, params: URLSearchParams) {
  const t = T();
  const [meta, financings, parties] = await Promise.all([
    get('meta'), get<Financing[]>('financings'), get<any[]>('parties')]);
  const datasets = meta.datasets as Record<string, { fields: Record<string, string>; measures: string[] }>;
  const ds = datasets[params.get('ds') ?? ''] ? params.get('ds')! : 'flow';
  const fields = datasets[ds].fields;
  const group = (params.get('group') ?? '').split(',').filter((g) => fields[g]);
  const measure = datasets[ds].measures.includes(params.get('measure') ?? '') ? params.get('measure')! : datasets[ds].measures[0];

  const select = (name: string, label: string, options: [string, string][], value: string | null) =>
    `<label>${esc(label)}<select name="${name}"><option value="">${t.all}</option>${options.map(([v, l]) =>
      `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const enumOpts = (f: string): [string, string][] => (fields[f] ?? '').replace('enum:', '').split(',').map((v) => [v, tr(v)]);

  const controls: string[] = [
    `<label>${t.dataset}<select name="ds">${Object.keys(datasets).map((k) =>
      `<option value="${k}" ${k === ds ? 'selected' : ''}>${esc(tr(`ds_${k}`))}</option>`).join('')}</select></label>`,
  ];
  if (fields.financing_id) {
    controls.push(select('fin', t.financing, financings.filter((f) => ds === 'party_year' || ds === 'mandates' ? f.kind === 'party_year' : true)
      .map((f) => [String(f.id), `${f.event_date ? date(f.event_date) : f.year} — ${f.title}`.slice(0, 110)]), params.get('fin')));
  }
  if (fields.financing_kind) controls.push(select('kind', t.kind, enumOpts('financing_kind'), params.get('kind')));
  if (fields.phase) controls.push(select('phase', t.phase, enumOpts('phase'), params.get('phase')));
  if (fields.stance) controls.push(select('stance', t.stance, enumOpts('stance'), params.get('stance')));
  if (fields.party_id) controls.push(select('party', t.party, parties.map((p) => [String(p.id), p.label]), params.get('party')));
  controls.push(`<label>${t.group_by}<span class="checks">${GROUPABLE.filter((g) => fields[g]).map((g) =>
    `<label class="check"><input type="checkbox" name="group" value="${g}" ${group.includes(g) ? 'checked' : ''}/>${esc(tr(g.replace(/_id$/, '')))}</label>`).join('')}</span></label>`);
  if (group.length) {
    controls.push(select('measure', t.amount, datasets[ds].measures.map((m) => [m, `${tr(m.split(':')[1] ?? m)} (${m.split(':')[0]})`]), measure)
      .replace(`<option value="">${t.all}</option>`, ''));
  }

  main.innerHTML = `<header class="page-head"><h1>${esc(t.explore_title)}</h1><p class="lead">${esc(t.explore_intro)}</p></header>
    <form class="card explore-form">${controls.join('')}</form>
    <section class="card"><div class="view-footer"><button class="link-btn" id="csv">${t.download_csv}</button><span class="muted" id="count"></span></div>
      <div id="result"><p class="muted">${t.loading}</p></div></section>`;

  const form = main.querySelector('form')!;
  form.addEventListener('change', () => {
    const fd = new FormData(form);
    const qs = new URLSearchParams();
    for (const [k] of FILTERS) if (fd.get(k)) qs.set(k, String(fd.get(k)));
    if (fd.get('ds') !== ds) { navigate(href(`explore?ds=${fd.get('ds')}`), true); return; }
    qs.set('ds', ds);
    const groups = fd.getAll('group').map(String);
    if (groups.length) qs.set('group', groups.join(','));
    if (groups.length && fd.get('measure')) qs.set('measure', String(fd.get('measure')));
    navigate(href(`explore?${qs}`), true);
  });

  const filter: Record<string, unknown> = {};
  for (const [k, f] of FILTERS) if (params.get(k) && fields[f]) filter[f] = params.get(k);
  const spec: QuerySpec = group.length
    ? { dataset: ds, group_by: group, measure: [measure], filter, limit: 500 }
    : { dataset: ds, filter, limit: 500 };
  try {
    const res = await query(spec);
    document.getElementById('result')!.innerHTML = renderTable(res.columns, res.rows);
    document.getElementById('count')!.textContent = t.rows_shown(res.rows.length, res.total);
    document.getElementById('csv')!.onclick = () => downloadCsv(`chpf-${ds}`, res.columns, res.rows);
  } catch (e) {
    document.getElementById('result')!.innerHTML = `<p class="error">${t.error} (${esc((e as Error).message)})</p>`;
  }
}
