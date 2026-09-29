// Generic, whitelisted query builder over the semantic views (config/datasets.json).
// Every identifier comes from the whitelist; every value is a bound parameter.

export class QueryError extends Error {}

const FILTER_KEY = /^filter\[(\w+)\](?:\[(gte|lte|ne)\])?$/;
const MAX_LIMIT = 5000;

function coerce(type, raw, field) {
  if (type === 'int') {
    if (!/^-?\d+$/.test(raw)) throw new QueryError(`filter ${field}: integer expected`);
    return Number(raw);
  }
  if (type === 'bool') {
    if (!['true', 'false', '1', '0'].includes(raw)) throw new QueryError(`filter ${field}: boolean expected`);
    return raw === 'true' || raw === '1' ? 1 : 0;
  }
  if (type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new QueryError(`filter ${field}: YYYY-MM-DD expected`);
    return raw;
  }
  if (type === 'money') {
    if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new QueryError(`filter ${field}: number expected`);
    return Number(raw);
  }
  if (type.startsWith('enum:')) {
    const allowed = type.slice(5).split(',');
    if (!allowed.includes(raw)) throw new QueryError(`filter ${field}: one of ${allowed.join(', ')}`);
    return raw;
  }
  if (raw.length > 200) throw new QueryError(`filter ${field}: too long`);
  return raw;
}

const alias = (measure) => measure.replace(/[:]/g, '_');

/**
 * Build SQL from query-string params.
 * Aggregate mode : group_by=a,b & measure=sum:value_chf,count
 * Rows mode      : no group_by (optionally columns=a,b)
 * Common         : filter[f]=v1,v2 · filter[f][gte|lte|ne]=v · order=-field|-sum:x · limit · offset
 */
export function buildQuery(config, params) {
  const ds = config.datasets[params.dataset];
  if (!ds) throw new QueryError(`unknown dataset; one of ${Object.keys(config.datasets).join(', ')}`);
  const fields = ds.fields;
  // fixed_filter comes from the trusted config file (e.g. the privacy guard on 'alignment'), never from the request
  const where = ds.fixed_filter ? [`(${ds.fixed_filter})`] : [];
  const args = [];

  for (const [key, value] of Object.entries(params)) {
    const m = FILTER_KEY.exec(key);
    if (!m) continue;
    const [, field, op] = m;
    if (!fields[field]) throw new QueryError(`cannot filter on ${field}`);
    const type = fields[field];
    const raw = Array.isArray(value) ? value.join(',') : String(value);
    if (op) {
      const sqlOp = { gte: '>=', lte: '<=', ne: '<>' }[op];
      where.push(`\`${field}\` ${sqlOp} ?`);
      args.push(coerce(type, raw, field));
    } else if (raw === 'null') {
      where.push(`\`${field}\` IS NULL`);
    } else {
      const values = raw.split(',').map((v) => coerce(type, v, field));
      where.push(`\`${field}\` IN (${values.map(() => '?').join(',')})`);
      args.push(...values);
    }
  }

  const groupBy = params.group_by ? String(params.group_by).split(',').filter(Boolean) : [];
  for (const g of groupBy) if (!fields[g]) throw new QueryError(`cannot group by ${g}`);

  let select;
  let columns;
  let measures = [];
  if (groupBy.length) {
    measures = (params.measure ? String(params.measure).split(',') : [Object.keys(ds.measures)[0]]);
    for (const ms of measures) if (!ds.measures[ms]) throw new QueryError(`unknown measure ${ms}`);
    columns = [...groupBy, ...measures.map(alias)];
    select = [...groupBy.map((g) => `\`${g}\``), ...measures.map((ms) => `${ds.measures[ms]} AS \`${alias(ms)}\``)];
  } else {
    columns = params.columns ? String(params.columns).split(',') : Object.keys(fields);
    for (const c of columns) if (!fields[c]) throw new QueryError(`unknown column ${c}`);
    select = columns.map((c) => `\`${c}\``);
  }

  let order = params.order ? String(params.order) : (groupBy.length ? `-${alias(measures[0])}` : ds.default_order);
  const desc = order.startsWith('-');
  order = alias(desc ? order.slice(1) : order);
  if (!columns.includes(order)) throw new QueryError(`cannot order by ${order}`);

  const limit = Math.min(Number.parseInt(params.limit ?? '100', 10) || 100, MAX_LIMIT);
  const offset = Math.max(Number.parseInt(params.offset ?? '0', 10) || 0, 0);

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const groupSql = groupBy.length ? ` GROUP BY ${groupBy.map((g) => `\`${g}\``).join(', ')}` : '';
  const sql = `SELECT ${select.join(', ')} FROM \`${ds.view}\`${whereSql}${groupSql}`
    + ` ORDER BY \`${order}\` ${desc ? 'DESC' : 'ASC'} LIMIT ${limit} OFFSET ${offset}`;
  const countSql = groupBy.length
    ? `SELECT COUNT(*) AS n FROM (SELECT 1 FROM \`${ds.view}\`${whereSql}${groupSql}) t`
    : `SELECT COUNT(*) AS n FROM \`${ds.view}\`${whereSql}`;
  return { sql, countSql, args, columns, limit, offset };
}
