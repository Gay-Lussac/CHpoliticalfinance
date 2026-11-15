// Canton and lake outlines for the vote maps -> public/geo/ch-cantons.json (GeoJSON, coordinates rounded to ~10 m).
// Source: swiss-maps (Interactive Things, BSD-3-Clause), built from the Federal Statistical Office's generalised
// boundaries (ThemaKart) and swisstopo data. The output is committed; to regenerate it, from web/:
//   npm install --no-save swiss-maps@4.7.0 topojson-client@3.1.0 && node scripts/make-ch-map.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const root = require.resolve('swiss-maps/package.json').replace(/package\.json$/, '');
const year = readdirSync(root).filter((d) => /^\d{4}$/.test(d)).sort().at(-1);
const topo = JSON.parse(readFileSync(`${root}${year}/ch-combined.json`, 'utf8'));
const CODES = ['', 'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR',
  'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'];
const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4] : c.map(round));
const clean = (f, props) => ({ type: 'Feature', properties: props, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } });

const cantons = feature(topo, topo.objects.cantons).features.map((f) => clean(f, { layer: 'canton', code: CODES[Number(f.id)] }));
const lakes = feature(topo, topo.objects.lakes).features.map((f) => clean(f, { layer: 'lake' }));
writeFileSync('public/geo/ch-cantons.json', JSON.stringify({ type: 'FeatureCollection',
  source: `swiss-maps ${year} (Interactive Things, BSD-3-Clause); FSO generalised boundaries / swisstopo`,
  features: [...cantons, ...lakes] }));
console.log(`${cantons.length} cantons, ${lakes.length} lakes from ${year}`);
