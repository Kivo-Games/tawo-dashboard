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
];

/** Group: KFE / DF – Subgroup: KFE Kit */
const KFE_KIT_COLUMNS: ColumnDef[] = [
  { key: 'kfeFalschGrund', label: 'KFE Falsch Grund', group: 'KFE / DF', subgroup: 'KFE Kit' },
  { key: 'kfeFit', label: 'KFE Fit', group: 'KFE / DF', subgroup: 'KFE Kit' },
  { key: 'kfeFitLangtext', label: 'KFE Fit Langtext', group: 'KFE / DF', subgroup: 'KFE Kit' },
];

/** All table columns in display order (21 columns). */
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
  'kfeDfId',
  'kfeDfZeit',
  'kfeFalschGrund',
  'kfeFit',
]);

/** Keys for text columns that get a max width (Kurztext, Langtext, KFE text columns). */
export const TEXT_COLUMN_KEYS = new Set([
  'shortText',
  'longText',
  'kfeDfKurztext',
  'kfeDfLangtext',
  'kfeFitLangtext',
]);

/** Column keys for "matching" section (Technische Einschätzung + KFE/DF) – show spinner here on matching page. */
export const MATCHING_SECTION_KEYS = new Set([
  ...TECH_COLUMNS.map((c) => c.key),
  ...KFE_DF_COLUMNS.map((c) => c.key),
  ...KFE_KIT_COLUMNS.map((c) => c.key),
]);

/** Group info for thead: group label and colspan. */
export type GroupHeader = { label: string; colspan: number; subgroup?: string };
export function getGroupHeaders(): GroupHeader[] {
  return [
    { label: 'Group: LV', colspan: LV_COLUMNS.length },
    { label: 'Group: Technische Einschätzung', colspan: TECH_COLUMNS.length },
    {
      label: 'Group: KFE / DF',
      colspan: KFE_DF_COLUMNS.length + KFE_KIT_COLUMNS.length,
    },
  ];
}

/** Subgroup headers for KFE/DF (Deal Fusion Match, KFE Kit). */
export function getKfeSubgroupHeaders(): { label: string; colspan: number }[] {
  return [
    { label: 'Subgroup 1: Deal Fusion Match', colspan: KFE_DF_COLUMNS.length },
    { label: 'Subgroup 2: KFE Kit', colspan: KFE_KIT_COLUMNS.length },
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
