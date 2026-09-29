import type { Ballot, Financing } from '../api';
import { chf, chfShort, date, esc } from '../format';
import { locale, T, tr } from '../i18n';
import { href } from '../router';

/** Phase shown by default: final accounts when published, else the budget. */
export const defaultPhase = (f: Financing) => (f.has_final ? 'final' : f.has_budget ? 'budget' : 'final');

export function sideTotals(f: Financing, phase: string) {
  const s = f.summary[phase] ?? {};
  return { yes: s.for?.total ?? 0, no: s.against?.total ?? 0, nYes: s.for?.n_actors ?? 0, nNo: s.against?.n_actors ?? 0 };
}

export function voteSentence(f: Financing, phase: string): string {
  const t = T();
  const { yes, no } = sideTotals(f, phase);
  if (!yes && !no) return t.no_data_yet;
  let ratio = '';
  if (yes && no) {
    const r = yes > no ? yes / no : no / yes;
    if (r >= 1.2) ratio = t.ratio_more(yes > no ? t.for : t.against, new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(r));
  }
  return t.vote_summary(chfShort(yes), chfShort(no), ratio);
}

/** Yes/No split bar used on cards and in page headers. */
export function splitBar(yes: number, no: number): string {
  const total = yes + no;
  if (!total) return `<div class="split empty"></div>`;
  const t = T();
  const py = (yes / total) * 100;
  return `<div class="split" role="img" aria-label="${esc(`${t.for} ${chf(yes)}, ${t.against} ${chf(no)}`)}">
      ${yes ? `<span class="yes" style="flex-basis:${py}%" data-tip="${esc(`${t.for}: ${chf(yes)}`)}"></span>` : ''}
      ${no ? `<span class="no" style="flex-basis:${100 - py}%" data-tip="${esc(`${t.against}: ${chf(no)}`)}"></span>` : ''}
    </div>
    <div class="split-legend"><span><i class="dot yes"></i>${t.for} ${chfShort(yes)}</span><span><i class="dot no"></i>${t.against} ${chfShort(no)}</span></div>`;
}

const pct = (v: number) => `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(v)} %`;

/** "Accepted · 58.3 % yes · 15 cantons · turnout 58.4 %" (or null if not voted yet). */
export function resultLine(b: Ballot, withTurnout = true): string | null {
  if (!b.outcome) return null;
  const t = T();
  const parts = [tr(b.outcome)];
  if (b.yes_share != null && b.role !== 'tie_break') parts.push(`${pct(b.yes_share)} ${t.yes_pct}`);
  if (b.cantons_yes != null && b.legal_form !== 'optional_referendum' && b.role !== 'tie_break') {
    parts.push(`${new Intl.NumberFormat(locale()).format(b.cantons_yes)} ${t.cantons_word}`);
  }
  if (withTurnout && b.turnout != null) parts.push(`${t.turnout_word} ${pct(b.turnout)}`);
  return parts.join(' · ');
}

const outcomeClass = (o: string | null) => (o === 'accepted' ? 'ok' : o === 'rejected' ? 'ko' : '');

/** Qualifier shown next to a chip; yes/no and tie-break preferences are already said by the group heading. */
function recNote(rec: string): string | null {
  const t = T();
  return ({ free: t.rec_free, blank: t.rec_blank, none: t.rec_none } as Record<string, string>)[rec] ?? null;
}

function recGroup(title: string, recs: Ballot['recommendations']): string {
  if (!recs?.length) return '';
  return `<div class="rec-group"><h3>${esc(title)}</h3><ul class="chips">${recs.map((r) =>
    `<li class="chip"><i class="dot" style="background:${esc(r.color ?? 'var(--neutral)')}"></i>${esc(r.label)}${
      recNote(r.recommendation) ? ` <span class="muted">(${esc(recNote(r.recommendation)!)})</span>` : ''}</li>`).join('')}</ul></div>`;
}

/** Result + recommendations for every ballot question of a vote (Swissvotes). */
export function ballotsCard(f: Financing): string {
  if (!f.ballots?.length) return '';
  const t = T();
  const many = f.ballots.length > 1;
  const blocks = f.ballots.map((b) => {
    const recs = b.recommendations ?? [];
    const line = resultLine(b);
    const head = many ? `<h3 class="ballot-title">${esc(b.role === 'main' ? tr(b.legal_form) : tr(b.role))}${b.title ? ` — ${esc(b.title)}` : ''}</h3>` : '';
    const result = line
      ? `<p class="result ${outcomeClass(b.outcome)}"><strong>${esc(line.split(' · ')[0])}</strong>${line.includes(' · ') ? ` · ${esc(line.split(' · ').slice(1).join(' · '))}` : ''}</p>`
      : `<p class="muted small">${esc(t.not_voted_yet)}</p>`;
    const yesLabel = b.role === 'tie_break' ? t.initiative_preferred : t.rec_yes;
    const noLabel = b.role === 'tie_break' ? t.counter_proposal_preferred : t.rec_no;
    const groups = b.role === 'tie_break'
      ? recGroup(yesLabel, recs.filter((r) => r.recommendation === 'prefer_initiative'))
        + recGroup(noLabel, recs.filter((r) => r.recommendation === 'prefer_counter_proposal'))
        + recGroup(t.rec_other, recs.filter((r) => !r.recommendation.startsWith('prefer')))
      : recGroup(yesLabel, recs.filter((r) => r.recommendation === 'yes'))
        + recGroup(noLabel, recs.filter((r) => r.recommendation === 'no'))
        + recGroup(t.rec_other, recs.filter((r) => !['yes', 'no'].includes(r.recommendation)));
    return `<div class="ballot">${head}${result}<div class="rec-groups">${groups}</div></div>`;
  }).join('');
  return `<section class="card ballots"><h2>${esc(t.result_title)}</h2>${blocks}
    <p class="muted small source">${esc(t.source_swissvotes)} — <a href="https://swissvotes.ch" target="_blank" rel="noopener">swissvotes.ch</a></p></section>`;
}

export function voteCard(f: Financing): string {
  const phase = defaultPhase(f);
  const { yes, no } = sideTotals(f, phase);
  const hasData = f.has_budget || f.has_final;
  return `<a class="card vote-card" href="${href(`vote/${f.id}`)}">
      <div class="card-meta"><span>${date(f.event_date)}</span>${hasData ? `<span class="badge ${phase}">${tr(phase)}</span>` : ''}</div>
      <h3>${esc(f.title)}</h3>
      ${hasData ? splitBar(yes, no) : `<p class="muted small">${T().no_data_yet}</p>`}
      ${(() => { const m = f.ballots?.find((b) => b.role === 'main'); const l = m && resultLine(m, false);
        return l ? `<p class="small result ${outcomeClass(m!.outcome)}">${esc(l)}</p>` : ''; })()}
    </a>`;
}

export function phaseToggle(f: Financing, phase: string, base: string): string {
  const t = T();
  const opt = (p: 'budget' | 'final', enabled: boolean) => enabled
    ? `<a href="${href(`${base}?phase=${p}`)}" class="${p === phase ? 'active' : ''}" title="${esc(p === 'budget' ? t.phase_budget_hint : t.phase_final_hint)}">${t[p]}</a>`
    : `<span class="disabled" title="${esc(t.no_data_yet)}">${t[p]}</span>`;
  return `<div class="segmented" role="group" aria-label="${t.phase}">${opt('budget', f.has_budget)}${opt('final', f.has_final)}</div>`;
}

export function statTiles(items: { label: string; value: string; sub?: string }[]): string {
  return `<div class="stats">${items.map((i) => `<div class="stat"><div class="stat-label">${esc(i.label)}</div>
    <div class="stat-value">${esc(i.value)}</div>${i.sub ? `<div class="stat-sub muted">${esc(i.sub)}</div>` : ''}</div>`).join('')}</div>`;
}

export const viewsGrid = (main: HTMLElement) => {
  const grid = document.createElement('div');
  grid.className = 'views-grid';
  main.append(grid);
  return grid;
};
