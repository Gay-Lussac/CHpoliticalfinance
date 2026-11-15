// Party levies on office holders ("contributions liées à un mandat"), declared in the parties' annual accounts.
// Institutions come as free text from the parties; they are grouped into a fixed set of codes.

const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const RULES = [
  ['CF', /conseil federal|bundesrat|consiglio federale/],
  ['CN', /conseil national|nationalrat|consiglio nazionale/],
  ['CE', /conseil des etats|standerat|consiglio degli stati/],
  ['TAF', /tribunal administratif|bundesverwaltungsgericht|tribunale amministrativo/],
  ['TPF', /tribunal penal|bundesstrafgericht|tribunale penale/],
  ['TFB', /brevets|bundespatentgericht|brevetti/],
  ['TF', /tribunal federal|bundesgericht|tribunale federale/],
  ['CHA', /chancel|kanzler|cancellier/],
];

/** 'Conseil national (-/-)' -> 'CN'; anything unknown -> 'OTHER'. Order matters (patent court before federal court). */
export function institutionCode(raw) {
  const t = fold(raw);
  for (const [code, re] of RULES) if (re.test(t)) return code;
  return 'OTHER';
}
