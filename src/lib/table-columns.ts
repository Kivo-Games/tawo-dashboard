/**
 * Single source of truth for table columns: keys, German labels, and group structure.
 * Used by upload (normalization), review, and matching pages.
 */

export type ColumnDef = { key: string; label: string; group: string; subgroup?: string };

/** Group: LV (Leistungsverzeichnis) */
const LV_COLUMNS: ColumnDef[] = [
  { key: 'type', label: 'Typ', group: 'LV' },
  { key: 'rNoPart', label: 'Ordnungszahl', group: 'LV' },
  { key: 'shortText', label: 'Kurztext', group: 'LV' },
  { key: 'longText', label: 'Langtext', group: 'LV' },
  { key: 'qty', label: 'Menge', group: 'LV' },
  { key: 'unit', label: 'Einheit', group: 'LV' },
  { key: 'unitPrice', label: 'Einheitspreis', group: 'LV' },
  { key: 'totalPrice', label: 'Gesamtpreis', group: 'LV' },
  { key: 'discount', label: 'Nachlass', group: 'LV' },
  { key: 'priceAfterDiscount', label: 'Preis nach Nachlass', group: 'LV' },
  { key: 'vat', label: 'MwSt.', group: 'LV' },
];

/** Group: Technische Einschätzung */
const TECH_COLUMNS: ColumnDef[] = [
  { key: 'leistungsgruppe', label: 'Leistungsgruppe', group: 'Technische Einschätzung' },
  { key: 'besonderheit', label: 'Besonderheit', group: 'Technische Einschätzung' },
  { key: 'kalkulationskomplexitaet', label: 'Kalkulationskomplexität', group: 'Technische Einschätzung' },
];

/** Group: KFE / DF – Subgroup: Deal Fusion Match */
const KFE_DF_COLUMNS: ColumnDef[] = [
  { key: 'kfeDfId', label: 'KFE DF ID', group: 'KFE / DF', subgroup: 'Deal Fusion Match' },
  { key: 'kfeDfKurztext', label: 'KFE DF Kurztext', group: 'KFE / DF', subgroup: 'Deal Fusion Match' },
  { key: 'kfeDfLangtext', label: 'KFE DF Langtext', group: 'KFE / DF', subgroup: 'Deal Fusion Match' },
  { key: 'kfeDfZeit', label: 'KFE DF Zeit', group: 'KFE / DF', subgroup: 'Deal Fusion Match' },
  { key: 'kfeDfMaterialkosten', label: 'Materialkosten', group: 'KFE / DF', subgroup: 'Deal Fusion Match' },
  { key: 'kfeDfKategorie', label: 'Kategorie', group: 'KFE / DF', subgroup: 'Deal Fusion Match' },
];

/** Group: KFE / DF – Subgroup: KFE Kit */
const KFE_KIT_COLUMNS: ColumnDef[] = [
  { key: 'kfeFalschGrund', label: 'KFE Falsch Grund', group: 'KFE / DF', subgroup: 'KFE Kit' },
];

/** All table columns in display order (19 columns). */
export const TABLE_COLUMNS: ColumnDef[] = [
  ...LV_COLUMNS,
  ...TECH_COLUMNS,
  ...KFE_DF_COLUMNS,
  ...KFE_KIT_COLUMNS,
];

/** Header keys only (for rows in sessionStorage). */
export const TABLE_HEADER_KEYS = TABLE_COLUMNS.map((c) => c.key);

/** Labels by key. */
export const TABLE_LABELS: Record<string, string> = TABLE_COLUMNS.reduce(
  (acc, c) => {
    acc[c.key] = c.label;
    return acc;
  },
  {} as Record<string, string>
);

/** Keys that are narrow (compact) for layout. */
export const COMPACT_COLUMN_KEYS = new Set([
  'type',
  'rNoPart',
  'qty',
  'unit',
]);

/** Keys for text columns that get a max width (Kurztext, Langtext, KFE text columns). */
export const TEXT_COLUMN_KEYS = new Set([
  'shortText',
  'longText',
  'kfeDfKurztext',
  'kfeDfLangtext',
]);

/** KFE columns that are main focus on matching (non-text): get medium width so they’re readable. */
export const KFE_MEDIUM_COLUMN_KEYS = new Set([
  'kfeDfId',
  'kfeDfZeit',
  'kfeDfMaterialkosten',
  'kfeDfKategorie',
  'kfeFalschGrund',
]);

/** All 7 KFE/DF columns – main focus on matching page alongside text columns. */
export const KFE_FOCUS_COLUMN_KEYS = new Set([
  ...KFE_DF_COLUMNS.map((c) => c.key),
  ...KFE_KIT_COLUMNS.map((c) => c.key),
]);

/** Column keys for "matching" section (Technische Einschätzung + KFE/DF) – show spinner here on matching page. */
export const MATCHING_SECTION_KEYS = new Set([
  ...TECH_COLUMNS.map((c) => c.key),
  ...KFE_DF_COLUMNS.map((c) => c.key),
  ...KFE_KIT_COLUMNS.map((c) => c.key),
]);

/** LV only (for Review page). */
export const LV_HEADER_KEYS = LV_COLUMNS.map((c) => c.key);

/** Column group names. */
export type ColumnGroup = 'LV' | 'Technische Einschätzung' | 'KFE / DF';

/** Get the group name for a column key. */
export function getColumnGroup(key: string): ColumnGroup | null {
  if (LV_COLUMNS.some((c) => c.key === key)) return 'LV';
  if (TECH_COLUMNS.some((c) => c.key === key)) return 'Technische Einschätzung';
  if (KFE_DF_COLUMNS.some((c) => c.key === key) || KFE_KIT_COLUMNS.some((c) => c.key === key))
    return 'KFE / DF';
  return null;
}

/** Check if a column key is the first column in its group (for visual separator). */
export function isFirstColumnInGroup(key: string, headers: string[]): boolean {
  const group = getColumnGroup(key);
  if (!group) return false;
  const idx = headers.indexOf(key);
  if (idx < 0) return false;
  // Check if previous column belongs to a different group
  if (idx === 0) return true;
  const prevGroup = getColumnGroup(headers[idx - 1]);
  return prevGroup !== group;
}

/** Group info for thead: label and colspan (no "Group" prefix). */
export type GroupHeader = { label: string; colspan: number; subgroup?: string };
export function getGroupHeaders(): GroupHeader[] {
  return [
    { label: 'LV', colspan: LV_COLUMNS.length },
    { label: 'Technische Einschätzung', colspan: TECH_COLUMNS.length },
    {
      label: 'KFE / DF',
      colspan: KFE_DF_COLUMNS.length + KFE_KIT_COLUMNS.length,
    },
  ];
}

/** Single group header for Review (LV only). */
export function getReviewGroupHeaders(): GroupHeader[] {
  return [{ label: 'LV', colspan: LV_COLUMNS.length }];
}

/** Subgroup headers for KFE/DF: Deal Fusion Match, KFE Kit (no "Subgroup" prefix). */
export function getKfeSubgroupHeaders(): { label: string; colspan: number }[] {
  return [
    { label: 'Deal Fusion Match', colspan: KFE_DF_COLUMNS.length },
    { label: 'KFE Kit', colspan: KFE_KIT_COLUMNS.length },
  ];
}

/** Map legacy API/CSV header names (or keys) to our column key. Used when normalizing CSV/API response. */
export const HEADER_TO_KEY: Record<string, string> = {
  type: 'type',
  typ: 'type',
  rNoPart: 'rNoPart',
  rnopart: 'rNoPart',
  partno: 'rNoPart',
  'part no.': 'rNoPart',
  ordnungszahl: 'rNoPart',
  pathNumbers: 'rNoPart',
  pathnumbers: 'rNoPart',
  path: 'rNoPart',
  shortText: 'shortText',
  shorttext: 'shortText',
  kurztext: 'shortText',
  longText: 'longText',
  longtext: 'longText',
  langtext: 'longText',
  qty: 'qty',
  quantity: 'qty',
  menge: 'qty',
  unit: 'unit',
  einheit: 'unit',
  unitPrice: 'unitPrice',
  unitprice: 'unitPrice',
  einheitspreis: 'unitPrice',
  totalPrice: 'totalPrice',
  totalprice: 'totalPrice',
  gesamtpreis: 'totalPrice',
  discount: 'discount',
  nachlass: 'discount',
  priceAfterDiscount: 'priceAfterDiscount',
  priceafterdiscount: 'priceAfterDiscount',
  'preis nach nachlass': 'priceAfterDiscount',
  vat: 'vat',
  mwst: 'vat',
  id: 'id',
};
TABLE_COLUMNS.forEach((c) => {
  HEADER_TO_KEY[c.key] = c.key;
  HEADER_TO_KEY[c.label.toLowerCase()] = c.key;
});

// --- Section / REMARK (Hinweis) helpers for GAEB hierarchy ---
// Hierarchy is based on dotted notation (1.1, 1.2, 1.2.1, 1.2.2). Indentation and
// remark→item mapping use path segments derived from this.

/** Normalize Ordnungszahl to dotted path (e.g. "1 > 2 > 1" → "1.2.1"). Assumes dotted notation from the flow; normalizes alternate separators. */
export function normalizeToDottedPath(rNoPart: string): string {
  const s = String(rNoPart ?? '').trim();
  if (!s) return '';
  return s
    .replace(/\s*>\s*/g, '.')
    .replace(/[\s,;]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
}

/** Path segments from Ordnungszahl in dotted notation (e.g. "1.2.3" -> ["1","2","3"]). */
export function getPathSegments(rNoPart: string): string[] {
  const dotted = normalizeToDottedPath(rNoPart);
  if (!dotted) return [];
  return dotted.split('.').filter(Boolean);
}

/** Path level from Ordnungszahl (e.g. "1.2.3" -> 3). Used for indentation. */
export function getPathLevel(rNoPart: string): number {
  return getPathSegments(rNoPart).length;
}

/** True if prefixSegments is a path prefix of fullSegments (e.g. [1,1] is prefix of [1,1,2]). */
export function isPathPrefix(prefixSegments: string[], fullSegments: string[]): boolean {
  if (prefixSegments.length > fullSegments.length) return false;
  return prefixSegments.every((s, i) => s === fullSegments[i]);
}

/** Indent in px: REMARK rows get 0 so they stick out; items get level * indentPerLevel. */
export const SECTION_INDENT_REMARK_PX = 0;
export const SECTION_INDENT_PER_LEVEL_PX = 14;

/**
 * For each row index, the REMARK row index that starts its section (section = from REMARK to next REMARK).
 * REMARK rows start a section; following rows belong to that section until the next REMARK.
 */
export function buildSectionStartByRowIndex(
  rows: Record<string, string>[],
  isRemark: (row: Record<string, string>) => boolean
): number[] {
  const result: number[] = [];
  let currentSectionStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if (isRemark(rows[i])) {
      currentSectionStart = i;
    }
    result[i] = currentSectionStart;
  }
  return result;
}

/** Section boundaries: list of { start, end } (end exclusive) for each REMARK-started section. */
export function buildSectionRanges(
  rows: Record<string, string>[],
  isRemark: (row: Record<string, string>) => boolean
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i < rows.length; i++) {
    if (isRemark(rows[i])) {
      if (start >= 0) ranges.push({ start, end: i });
      start = i;
    }
  }
  if (start >= 0) ranges.push({ start, end: rows.length });
  return ranges;
}
