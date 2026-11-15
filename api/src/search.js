// Site search: keyword matching that forgives the usual differences between what people type and how things are
// written. Every word of the query must match (in any order), ignoring case and accents; a word matches a whole word,
// the start of a word, part of a long compound word ("rente" in "Renteninitiative") or, for longer words, the same
// word with one or two typos. Votes are also found through their Swissvotes policy areas and related terms in all four
// languages (config/policy_areas.yaml), so "retraite" finds the AHV votes. Everything runs in memory on our server.

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const tokens = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// Words too common to mean anything on their own (fr, de, it, en).
const STOP = new Set(('le la les l de des du d un une et ou en au aux a sur pour par dans avec ce cette ces qui que '
  + 'der die das den dem des ein eine einer und oder im in zu zur zum fur von vom mit auf an '
  + 'il lo gli i e o di del della dei delle per con su un una '
  + 'the of and or for on in to a an with').split(' '));

/** Damerau-free Levenshtein distance, giving up as soon as it exceeds `max`. */
function within(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** How well one query word matches one word of a document: 0 = not at all. */
export function wordScore(q, w) {
  if (w === q) return 3;
  if (w.startsWith(q)) return q.length >= 2 ? 2 : 0;
  if (q.length >= 5 && w.length > q.length + 2 && w.includes(q)) return 1.5;       // part of a compound word
  if (q.length >= 5) {
    const max = q.length >= 9 ? 2 : 1;
    if (within(q, w, max) || (w.length > q.length && within(q, w.slice(0, q.length), max))) return 1;
  } else if (q.length === 4 && w.length >= 4 && within(q, w, 1)) {
    return 0.8;                                                                     // "gosi" -> "gossi"
  }
  return 0;
}

/**
 * docs: [{ group, id, label: string | {lang: string}, date?, extra?, fields: [{ text, weight, area? }] }]
 * Each field is tokenised once. A field with `area` (a policy-area code) is reported back when it decided the match.
 */
export function buildIndex(docs) {
  return docs.map((d) => ({ ...d, fields: d.fields.filter((f) => f.text).map((f) => ({ ...f, words: [...new Set(tokens(f.text))],
    folded: fold(f.text) })) }));
}

export function queryWords(q) {
  const all = tokens(q).slice(0, 8);
  const kept = all.filter((w) => !STOP.has(w));
  return kept.length ? kept : all;
}

/** Best match of every query word in a document, or null when one word matches nowhere. */
function scoreDoc(doc, words, phrase) {
  let total = 0;
  let area = null;
  for (const q of words) {
    let best = 0;
    let bestField = null;
    for (const f of doc.fields) {
      for (const w of f.words) {
        const s = wordScore(q, w) * f.weight;
        if (s > best) { best = s; bestField = f; }
      }
    }
    if (!best) return null;
    total += best;
    if (bestField.area) area ??= bestField.area;
  }
  if (phrase.length > 3 && doc.fields.some((f) => !f.area && f.folded.includes(phrase))) total += 4;
  return { score: total, area };
}

/** Top `limit` documents per group for a query, best first (more recent first on ties). */
export function search(index, q, lang, limit = 8, areaName = () => null) {
  const words = queryWords(q);
  if (!words.length) return {};
  const phrase = fold(q).trim();
  const groups = {};
  for (const doc of index) {
    const r = scoreDoc(doc, words, phrase);
    if (!r) continue;
    (groups[doc.group] ??= []).push({ doc, ...r });
  }
  const out = {};
  for (const [g, hits] of Object.entries(groups)) {
    hits.sort((a, b) => b.score - a.score || String(b.doc.date ?? '').localeCompare(String(a.doc.date ?? '')));
    out[g] = hits.slice(0, limit).map(({ doc, area }) => ({ id: doc.id,
      label: typeof doc.label === 'string' ? doc.label : doc.label[lang] ?? doc.label.fr,
      ...doc.extra, ...(area ? { via: areaName(area, lang) } : {}) }));
  }
  return out;
}

/**
 * config/policy_areas.yaml is written as one flow mapping per line with JSON-quoted values
 * ('"10.21": { de: "…", fr: "…", words: ["…"] }'), so it is read here without a YAML library.
 */
export function parsePolicyAreas(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^"([0-9.]+)":\s*(\{.*\})\s*$/.exec(line);
    if (m) out[m[1]] = JSON.parse(m[2].replace(/([{,]\s*)([a-z]+):/g, '$1"$2":'));
  }
  return out;
}

/** "10.21" -> ["10.21", "10.2", "10"]: the code and its broader areas. */
export function areaChain(code) {
  const [top, rest = ''] = String(code).split('.');
  const chain = [top];
  if (rest) chain.unshift(`${top}.${rest[0]}`);
  if (rest.length > 1) chain.unshift(`${top}.${rest}`);
  return chain;
}
