// Resolve ids to readable labels in the requested language (official FR/DE/IT, fallback FR).

export const LANGS = ['fr', 'de', 'it', 'en'];

// Label fallback chain: requested language, then the other official languages.
const chain = (lang) => [lang, ...['fr', 'de', 'it', 'en'].filter((l) => l !== lang)];

// SQL expression for a translated field of an entity (uses i18n_label).
export function i18nExpr(entity, idExpr, field, lang, fallbackExpr) {
  const parts = chain(lang).map(
    (l) => `(SELECT text FROM i18n_label WHERE entity='${entity}' AND entity_id=${idExpr} AND field='${field}' AND lang='${l}')`,
  );
  return `COALESCE(${parts.join(', ')}${fallbackExpr ? `, ${fallbackExpr}` : ''})`;
}

const RESOLVERS = {
  financing: (lang) => `SELECT f.id, ${i18nExpr('financing', 'f.id', 'title', lang, 'f.name')} AS label,
                          f.kind, f.event_date AS date, f.year FROM financing f WHERE f.id IN (?)`,
  actor: () => 'SELECT id, name AS label, city, canton FROM actor WHERE id IN (?)',
  donor: () => 'SELECT id, display_name AS label, city, donor_type FROM donor WHERE id IN (?)',
  party: (lang) => `SELECT p.id, ${i18nExpr('party', 'p.id', 'name', lang, 'p.code')} AS label, p.code, p.color
                      FROM party p WHERE p.id IN (?)`,
  campaign: () => 'SELECT id, LEFT(name, 120) AS label FROM campaign WHERE id IN (?)',
  recommender: (lang) => `SELECT r.id, COALESCE(${i18nExpr('party', 'p.id', 'name', lang, 'NULL')},
                            ${i18nExpr('recommender', 'r.id', 'name', lang, 'r.code')}) AS label,
                            r.kind, p.code, COALESCE(p.color, NULL) AS color
                          FROM recommender r LEFT JOIN party p ON p.id = r.party_id WHERE r.id IN (?)`,
};

/** Adds `<col>_label` (and extra info under `<col>_info`) for every id column that has a label type. */
export async function attachLabels(pool, config, columns, rows, lang) {
  for (const col of columns) {
    const entity = config.labels[col];
    if (!entity || !rows.length) continue;
    const ids = [...new Set(rows.map((r) => r[col]).filter((v) => v != null))];
    if (!ids.length) continue;
    const [found] = await pool.query(RESOLVERS[entity](lang), [ids]);
    const byId = new Map(found.map((f) => [f.id, f]));
    for (const r of rows) {
      const f = byId.get(r[col]);
      if (!f) continue;
      const { id, label, ...info } = f;
      r[`${col}_label`] = label;
      r[`${col}_info`] = info;
    }
  }
  return rows;
}
