'use client';

import { ChevronDown, ChevronUp, ChevronRight, Loader2, Copy, Check, FileText, Download } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LV_HEADER_KEYS,
  COMPACT_COLUMN_KEYS,
  TEXT_COLUMN_KEYS,
  KFE_MEDIUM_COLUMN_KEYS,
  MATCHING_SECTION_KEYS,
  getGroupHeaders,
  getKfeSubgroupHeaders,
  getPathLevel,
  getPathSegments,
  isPathPrefix,
  buildSectionStartByRowIndex,
  buildSectionRanges,
  SECTION_INDENT_REMARK_PX,
  SECTION_INDENT_PER_LEVEL_PX,
  getColumnGroup,
  isFirstColumnInGroup,
  type ColumnGroup,
} from '@/lib/table-columns';

const EXPAND_THRESHOLD = 35;
const REVIEW_STORAGE_KEY = 'tawo_review_data';
const MATCHING_SENT_KEY = 'tawo_matching_sent';
const DONE_ROWS_STORAGE_PREFIX = 'tawo_matching_done_';
const MATCH_RESULTS_CACHE_PREFIX = 'tawo_matching_results_';
const MATCH_SELECTION_CACHE_PREFIX = 'tawo_matching_selection_';
const MATCH_FALSCH_CACHE_PREFIX = 'tawo_matching_falsch_';

/** Stable key for current dataset so we don't resend on revisit. */
function getMatchingSentKey(data: ReviewData): string {
  const rows = data?.tableData?.rows;
  const firstId = rows?.[0]?.['id'] ?? '';
  return `${data.fileName ?? ''}-${rows?.length ?? 0}-${firstId}`;
}

/** Remark rows apply to item rows whose rNoPart (dotted notation, e.g. 1.1, 1.2.1) has the remark's rNoPart as path prefix (e.g. remark 1.1 → items 1.1.1, 1.1.2). */
function getRemarksForItemRow(
  rows: Record<string, string>[],
  itemRow: Record<string, string>,
  isRemarkRow: (row: Record<string, string>) => boolean
): Record<string, string>[] {
  const itemPath = getPathSegments(String(itemRow['rNoPart'] ?? ''));
  const remarkRows: { row: Record<string, string>; pathSegments: string[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!isRemarkRow(r)) continue;
    const segs = getPathSegments(String(r['rNoPart'] ?? ''));
    if (segs.length > 0 && isPathPrefix(segs, itemPath)) remarkRows.push({ row: r, pathSegments: segs });
  }
  remarkRows.sort((a, b) => a.pathSegments.length - b.pathSegments.length);
  return remarkRows.map((x) => x.row);
}

/** Build webhook rows: [ fileInfo, ...remark rows, item row ]. */
function buildMatchingPayloadRows(
  rows: Record<string, string>[],
  itemRow: Record<string, string>,
  fileId: string,
  fileName: string,
  isRemarkRow: (row: Record<string, string>) => boolean
): (Record<string, string> | { id: string; name: string })[] {
  const fileInfo = { id: fileId, name: fileName };
  const remarks = getRemarksForItemRow(rows, itemRow, isRemarkRow);
  return [fileInfo, ...remarks, itemRow];
}

const COL_MIN_COMPACT = 36;
const TEXT_COLUMN_WIDTH = 220;
/** KFE columns (main focus): text ones 220, ID/Zeit/Falsch Grund/Fit get medium width. */
const KFE_MEDIUM_WIDTH = 140;
const COL_MIN_DEFAULT = 56;

const MATCHING_API_URL = '/api/matching-webhook';
const CONFIRMED_MATCH_WEBHOOK_URL = 'https://tawo.app.n8n.cloud/webhook/confirmed-match';
/** Client and server can wait up to 15 minutes per matching request. */
const MATCHING_REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

/** Leistung block from kfe_merged (KFE/DF source). */
export type KfeMergedLeistung = {
  Leistungs_ID?: string;
  Chapter_Identifier?: string;
  Kapitel?: string;
  Kategorie?: string;
  Subkategorie?: string;
  Kurzbeschreibung?: string;
  Leistungsbeschreibung?: string;
  Netto_Minuten_per_1unit?: string;
  Materialkosten?: string;
};

/** One entry in kfe_merged from the new matching webhook response. */
export type KfeMergedEntry = {
  source_id: string;
  leistungs_id: string;
  combined_score: number;
  artikel?: Record<string, unknown>;
  leistung?: KfeMergedLeistung;
};

/** New webhook response: one object per row with kfe_merged. */
export type MatchingRowResponse = {
  lv_row_id?: string;
  match_found?: boolean;
  best_match?: Record<string, unknown>;
  top_5_matches?: unknown[];
  kfe_merged?: KfeMergedEntry[];
};

/** One option from the matching API top_5_matches (legacy). */
export type TopMatch = {
  titel: string;
  source_id: string;
  source_type: string;
  combined_score: number;
};

/** Match result returned per row from the matching webhook. */
export type MatchResult = {
  matched_leistungs_id?: string;
  matched_titel?: string;
  matched_embed_text?: string;
  matched_source_id?: string;
  match_status?: string;
  top_5_matches?: TopMatch[];
  /** If present, use for KFE DF Zeit (legacy). */
  kfe_df_zeit?: string;
  /** New format: merged KFE options with leistung/artikel. */
  kfe_merged?: KfeMergedEntry[];
};

/** Extract the single match result from various n8n/API response shapes. */
function extractMatchResult(data: unknown): MatchResult | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  // New format: has kfe_merged array
  if (Array.isArray(d.kfe_merged) && d.kfe_merged.length > 0) {
    return d as unknown as MatchResult;
  }
  // Legacy: direct match object (has match fields at top level)
  if ('matched_titel' in d || 'matched_leistungs_id' in d || 'top_5_matches' in d) {
    return d as unknown as MatchResult;
  }
  // Array: take first element
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === 'object' ? extractMatchResult(first) : null;
  }
  // Wrapper: data.data, data.result, data.results[0], data.output
  if (d.data != null) return extractMatchResult(d.data);
  if (d.result != null) return extractMatchResult(d.result);
  if (Array.isArray(d.results) && d.results[0] != null) return extractMatchResult(d.results[0]);
  if (d.output != null) return extractMatchResult(d.output);
  return null;
}

type TableData = {
  headers: string[];
  rows: Record<string, string>[];
  labels?: Record<string, string>;
};

type ReviewData = {
  tableData: TableData;
  projectName: string;
  margin: string;
  fileName: string;
};

const KFE_FALSCH_GRUND_OPTIONS = ['falsche montageart'] as const;

export default function MatchingPage() {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [statsVisible, setStatsVisible] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  /** Row indices still waiting for matching response (concurrent sends). */
  const [sendingRowIndices, setSendingRowIndices] = useState<Set<number>>(new Set());
  /** Incremented when user chooses "rerun only missing"; effect runs retry for rows without result. */
  const [retryMissingTrigger, setRetryMissingTrigger] = useState(0);
  const lastRetryTriggerRef = useRef(0);
  /** Avoid re-starting initial send on every re-render (runSend sets state and would re-trigger effect). */
  const initialSendStartedForTriggerRef = useRef<number | null>(null);
  /** Only sync webhookStatus to 'done' once when alreadySent, to avoid effect→setState→re-render loops. */
  const alreadySentDoneSyncedRef = useRef(false);
  const lastSentKeyRef = useRef<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [collapsedColumnGroups, setCollapsedColumnGroups] = useState<Set<ColumnGroup>>(new Set());
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null);
  const [rerunTrigger, setRerunTrigger] = useState(0);
  /** Match result from API per table row index (only item rows). */
  const [matchResultsByRow, setMatchResultsByRow] = useState<Record<number, MatchResult>>({});
  /** Selected top_5 index (0 = main match, 1–4 = alternative). */
  const [selectedMatchIndexByRow, setSelectedMatchIndexByRow] = useState<Record<number, number>>({});
  /** KFE Falsch Grund when user selected a non-first match. */
  const [kfeFalschGrundByRow, setKfeFalschGrundByRow] = useState<Record<number, string>>({});
  /** Row indices marked as done (green). Persisted per dataset. */
  const [doneRowIndices, setDoneRowIndices] = useState<Set<number>>(new Set());
  /** Inline edit: which cell is being edited and current input value. */
  const [editingCell, setEditingCell] = useState<{ rIdx: number; key: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [tableCopied, setTableCopied] = useState(false);

  const copyCellId = (rIdx: number, key: string) => `${rIdx}-${key}`;
  const handleCopyCell = async (text: string, rIdx: number, key: string) => {
    const toCopy = text ?? '';
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopiedCellId(copyCellId(rIdx, key));
      setTimeout(() => setCopiedCellId(null), 1500);
    } catch {}
  };

  const isRowExpanded = (rIdx: number) => expandedRows.has(rIdx);
  const isLong = (text: string) => text.length > EXPAND_THRESHOLD;
  const toggleExpandRow = (rIdx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rIdx)) next.delete(rIdx);
      else next.add(rIdx);
      return next;
    });
  };
  const isRemarkRow = (row: Record<string, string>) =>
    String(row['type'] ?? '').toUpperCase() === 'REMARK';

  /** For item rows with match result: options from kfe_merged, or legacy best_match + top_5_matches. */
  const getMatchOptions = (rIdx: number): { index: number; titel: string; id: string; idWithScore: string; langtext: string }[] => {
    const mr = matchResultsByRow[rIdx];
    if (!mr) return [];
    const kfe = mr.kfe_merged;
    if (Array.isArray(kfe) && kfe.length > 0) {
      return kfe.map((entry, i) => {
        const leistung = entry.leistung;
        const scorePct = (entry.combined_score * 100).toFixed(1);
        return {
          index: i,
          titel: leistung?.Kurzbeschreibung ?? '',
          id: entry.leistungs_id,
          idWithScore: `${entry.leistungs_id} (${scorePct}%)`,
          langtext: leistung?.Leistungsbeschreibung ?? '',
        };
      });
    }
    const opts: { index: number; titel: string; id: string; idWithScore: string; langtext: string }[] = [
      {
        index: 0,
        titel: mr.matched_titel ?? '',
        id: mr.matched_leistungs_id ?? mr.matched_source_id ?? '',
        idWithScore: mr.matched_leistungs_id ?? mr.matched_source_id ?? '',
        langtext: mr.matched_embed_text ?? '',
      },
    ];
    const top5 = mr.top_5_matches ?? [];
    for (let i = 1; i < 5 && i < top5.length; i++) {
      const m = top5[i];
      opts.push({ index: i, titel: m.titel, id: m.source_id, idWithScore: m.source_id, langtext: '' });
    }
    return opts;
  };

  /** Full match entry for a row at given option index (for webhook payload). */
  const getMatchEntryForOption = (
    rIdx: number,
    optionIndex: number
  ): KfeMergedEntry | Record<string, unknown> | null => {
    const mr = matchResultsByRow[rIdx];
    if (!mr) return null;
    const kfe = mr.kfe_merged;
    if (Array.isArray(kfe) && kfe[optionIndex]) return kfe[optionIndex];
    const opts = getMatchOptions(rIdx);
    const opt = opts[optionIndex];
    if (!opt) {
      if (optionIndex === 0) {
        return {
          leistungs_id: mr.matched_leistungs_id ?? mr.matched_source_id,
          source_id: mr.matched_source_id,
          combined_score: 0,
          titel: mr.matched_titel,
          langtext: mr.matched_embed_text,
        };
      }
      return null;
    }
    return {
      leistungs_id: opt.id,
      source_id: opt.id,
      combined_score: 0,
      titel: opt.titel,
      langtext: opt.langtext,
    };
  };

  /** Effective KFE DF values for this row and selected match index (from kfe_merged or legacy). */
  const getKfeDfForRow = (rIdx: number): {
    id: string;
    idWithScore: string;
    kurztext: string;
    langtext: string;
    zeit: string;
    materialkosten: string;
    kategorie: string;
  } => {
    const empty = {
      id: '',
      idWithScore: '',
      kurztext: '',
      langtext: '',
      zeit: '',
      materialkosten: '',
      kategorie: '',
    };
    const mr = matchResultsByRow[rIdx];
    const sel = selectedMatchIndexByRow[rIdx] ?? 0;
    if (!mr) return empty;
    const kfe = mr.kfe_merged;
    if (Array.isArray(kfe) && kfe[sel]) {
      const entry = kfe[sel];
      const leistung = entry.leistung ?? {};
      const scorePct = (entry.combined_score * 100).toFixed(1);
      return {
        id: entry.leistungs_id,
        idWithScore: `${entry.leistungs_id} (${scorePct}%)`,
        kurztext: leistung.Kurzbeschreibung ?? '',
        langtext: leistung.Leistungsbeschreibung ?? '',
        zeit: leistung.Netto_Minuten_per_1unit ?? '',
        materialkosten: leistung.Materialkosten ?? '',
        kategorie: leistung.Kategorie ?? '',
      };
    }
    const opts = getMatchOptions(rIdx);
    const chosen = opts[sel];
    if (!chosen) {
      return {
        id: mr.matched_leistungs_id ?? mr.matched_source_id ?? '',
        idWithScore: mr.matched_leistungs_id ?? mr.matched_source_id ?? '',
        kurztext: mr.matched_titel ?? '',
        langtext: mr.matched_embed_text ?? '',
        zeit: mr.kfe_df_zeit ?? '',
        materialkosten: '',
        kategorie: '',
      };
    }
    return {
      id: chosen.id,
      idWithScore: chosen.idWithScore,
      kurztext: chosen.titel,
      langtext: chosen.langtext || chosen.titel,
      zeit: mr.kfe_df_zeit ?? '',
      materialkosten: '',
      kategorie: '',
    };
  };

  const toggleDoneRow = (rIdx: number) => {
    setDoneRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(rIdx)) next.delete(rIdx);
      else next.add(rIdx);
      if (reviewData) {
        try {
          const sentKey = getMatchingSentKey(reviewData);
          sessionStorage.setItem(DONE_ROWS_STORAGE_PREFIX + sentKey, JSON.stringify(Array.from(next)));
        } catch {}
      }
      return next;
    });
  };

  const isRowDone = (rIdx: number) => doneRowIndices.has(rIdx);

  const startEditCell = (rIdx: number, key: string, currentValue: string) => {
    setEditingCell({ rIdx, key });
    setEditingValue(currentValue);
  };

  const saveEditCell = () => {
    if (!editingCell || !reviewData) return;
    const { rIdx, key } = editingCell;
    const rows = [...reviewData.tableData.rows];
    if (rows[rIdx]) {
      rows[rIdx] = { ...rows[rIdx], [key]: editingValue };
      const updated: ReviewData = {
        ...reviewData,
        tableData: { ...reviewData.tableData, rows },
      };
      setReviewData(updated);
      try {
        sessionStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const cancelEditCell = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  /** Build table as TSV string (headers + rows) for clipboard or CSV export. Uses display values (match result for KFE when present). */
  const buildTableTsv = (): string => {
    const headers = tableData.headers;
    const labels = tableData.labels ?? {};
    const headerLine = headers.map((h) => labels[h] ?? h).join('\t');
    const dataLines = tableData.rows.map((row, rIdx) => {
      const remarkRow = isRemarkRow(row);
      const hasMatch = !remarkRow && Boolean(matchResultsByRow[rIdx]);
      const kfeDf = hasMatch ? getKfeDfForRow(rIdx) : null;
      const sel = selectedMatchIndexByRow[rIdx] ?? 0;
      const showFalsch = hasMatch && sel !== 0;
      const falschVal = kfeFalschGrundByRow[rIdx] ?? '';
      return headers
        .map((key) => {
          if (hasMatch && MATCHING_SECTION_KEYS.has(key)) {
            if (key === 'kfeDfId') return kfeDf?.id ?? row[key] ?? '';
            if (key === 'kfeDfKurztext') return kfeDf?.kurztext ?? row[key] ?? '';
            if (key === 'kfeDfLangtext') return kfeDf?.langtext ?? row[key] ?? '';
            if (key === 'kfeDfZeit') return kfeDf?.zeit ?? row[key] ?? '';
            if (key === 'kfeDfMaterialkosten') return kfeDf?.materialkosten ?? row[key] ?? '';
            if (key === 'kfeDfKategorie') return kfeDf?.kategorie ?? row[key] ?? '';
            if (key === 'kfeFalschGrund') return showFalsch ? falschVal : '';
          }
          return String(row[key] ?? '');
        })
        .join('\t');
    });
    return [headerLine, ...dataLines].join('\n');
  };

  const buildTableCsv = (): string => {
    const escape = (v: string) => {
      const s = String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = tableData.headers;
    const labels = tableData.labels ?? {};
    const headerLine = headers.map((h) => escape(labels[h] ?? h)).join(',');
    const dataLines = tableData.rows.map((row, rIdx) => {
      const remarkRow = isRemarkRow(row);
      const hasMatch = !remarkRow && Boolean(matchResultsByRow[rIdx]);
      const kfeDf = hasMatch ? getKfeDfForRow(rIdx) : null;
      const sel = selectedMatchIndexByRow[rIdx] ?? 0;
      const showFalsch = hasMatch && sel !== 0;
      const falschVal = kfeFalschGrundByRow[rIdx] ?? '';
      return headers
        .map((key) => {
          let val: string;
          if (hasMatch && MATCHING_SECTION_KEYS.has(key)) {
            if (key === 'kfeDfId') val = kfeDf?.id ?? row[key] ?? '';
            else if (key === 'kfeDfKurztext') val = kfeDf?.kurztext ?? row[key] ?? '';
            else if (key === 'kfeDfLangtext') val = kfeDf?.langtext ?? row[key] ?? '';
            else if (key === 'kfeDfZeit') val = kfeDf?.zeit ?? row[key] ?? '';
            else if (key === 'kfeDfMaterialkosten') val = kfeDf?.materialkosten ?? row[key] ?? '';
            else if (key === 'kfeDfKategorie') val = kfeDf?.kategorie ?? row[key] ?? '';
            else if (key === 'kfeFalschGrund') val = showFalsch ? falschVal : '';
            else val = String(row[key] ?? '');
          } else val = String(row[key] ?? '');
          return escape(val);
        })
        .join(',');
    });
    return [headerLine, ...dataLines].join('\n');
  };

  const handleCopyTable = async () => {
    try {
      await navigator.clipboard.writeText(buildTableTsv());
      setTableCopied(true);
      setTimeout(() => setTableCopied(false), 2000);
    } catch {}
  };

  const handleExportCsv = () => {
    const csv = buildTableCsv();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'matching'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setSelectedMatch = (rIdx: number, index: number) => {
    const oldIndex = selectedMatchIndexByRow[rIdx] ?? 0;
    if (oldIndex === index) return;

    const row = reviewData?.tableData?.rows[rIdx];
    const oldMatch = getMatchEntryForOption(rIdx, oldIndex);
    const correctedMatch = getMatchEntryForOption(rIdx, index);

    setSelectedMatchIndexByRow((prev) => ({ ...prev, [rIdx]: index }));
    if (index === 0) {
      setKfeFalschGrundByRow((prev) => {
        const next = { ...prev };
        delete next[rIdx];
        return next;
      });
    } else {
      setKfeFalschGrundByRow((prev) => ({ ...prev, [rIdx]: KFE_FALSCH_GRUND_OPTIONS[0] }));
    }

    if (row && oldMatch != null && correctedMatch != null) {
      const payload = {
        ...row,
        corrected_match: correctedMatch,
        old_match: oldMatch,
        ...(index !== 0 && { kfe_falsch_grund: KFE_FALSCH_GRUND_OPTIONS[0] }),
      };
      fetch(CONFIRMED_MATCH_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => console.error('Confirmed-match webhook failed:', err));
    }
  };

  const tableRows = reviewData?.tableData?.rows ?? [];
  const sectionStartByRow = useMemo(
    () => buildSectionStartByRowIndex(tableRows, isRemarkRow),
    [tableRows]
  );
  const sectionRanges = useMemo(
    () => buildSectionRanges(tableRows, isRemarkRow),
    [tableRows]
  );
  const sectionHasChildren = (remarkRowIndex: number) => {
    const r = sectionRanges.find((s) => s.start === remarkRowIndex);
    return r ? r.end - r.start > 1 : false;
  };
  const toggleSectionCollapsed = (remarkRowIndex: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(remarkRowIndex)) next.delete(remarkRowIndex);
      else next.add(remarkRowIndex);
      return next;
    });
  };
  const toggleColumnGroupCollapsed = (group: ColumnGroup) => {
    setCollapsedColumnGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };
  const isColumnGroupCollapsed = (group: ColumnGroup) => collapsedColumnGroups.has(group);
  const isRowInCollapsedSection = (rIdx: number) => {
    const sectionStart = sectionStartByRow[rIdx];
    if (sectionStart < 0) return false;
    if (collapsedSections.has(sectionStart) && sectionStart !== rIdx) return true;
    return false;
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REVIEW_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as ReviewData;
        if (data?.tableData?.headers && Array.isArray(data.tableData.rows)) {
          setReviewData(data);
          const sentKey = getMatchingSentKey(data);
          const doneRaw = sessionStorage.getItem(DONE_ROWS_STORAGE_PREFIX + sentKey);
          if (doneRaw) {
            try {
              const arr = JSON.parse(doneRaw) as number[];
              setDoneRowIndices(new Set(Array.isArray(arr) ? arr : []));
            } catch {}
          }
          const resultsRaw = sessionStorage.getItem(MATCH_RESULTS_CACHE_PREFIX + sentKey);
          if (resultsRaw) {
            try {
              const obj = JSON.parse(resultsRaw) as Record<string, MatchResult>;
              if (obj && typeof obj === 'object') {
                const parsed: Record<number, MatchResult> = {};
                Object.keys(obj).forEach((k) => {
                  const n = Number(k);
                  if (!Number.isNaN(n) && obj[k] && typeof obj[k] === 'object') parsed[n] = obj[k] as MatchResult;
                });
                setMatchResultsByRow(parsed);
              }
            } catch {}
          }
          const selectionRaw = sessionStorage.getItem(MATCH_SELECTION_CACHE_PREFIX + sentKey);
          if (selectionRaw) {
            try {
              const obj = JSON.parse(selectionRaw) as Record<string, number>;
              if (obj && typeof obj === 'object') {
                const parsed: Record<number, number> = {};
                Object.keys(obj).forEach((k) => {
                  const n = Number(k);
                  if (!Number.isNaN(n)) parsed[n] = Number(obj[k]);
                });
                setSelectedMatchIndexByRow(parsed);
              }
            } catch {}
          }
          const falschRaw = sessionStorage.getItem(MATCH_FALSCH_CACHE_PREFIX + sentKey);
          if (falschRaw) {
            try {
              const obj = JSON.parse(falschRaw) as Record<string, string>;
              if (obj && typeof obj === 'object') {
                const parsed: Record<number, string> = {};
                Object.keys(obj).forEach((k) => {
                  const n = Number(k);
                  if (!Number.isNaN(n) && typeof obj[k] === 'string') parsed[n] = obj[k];
                });
                setKfeFalschGrundByRow(parsed);
              }
            } catch {}
          }
        }
      }
    } catch {
      setReviewData(null);
    }
  }, []);

  // Persist matching results and selections to sessionStorage so they survive tab navigation
  useEffect(() => {
    if (!reviewData) return;
    const sentKey = getMatchingSentKey(reviewData);
    try {
      sessionStorage.setItem(MATCH_RESULTS_CACHE_PREFIX + sentKey, JSON.stringify(matchResultsByRow));
      sessionStorage.setItem(MATCH_SELECTION_CACHE_PREFIX + sentKey, JSON.stringify(selectedMatchIndexByRow));
      sessionStorage.setItem(MATCH_FALSCH_CACHE_PREFIX + sentKey, JSON.stringify(kfeFalschGrundByRow));
    } catch {}
  }, [reviewData, matchResultsByRow, selectedMatchIndexByRow, kfeFalschGrundByRow]);

  // Slowly hide the stats section after mount
  useEffect(() => {
    const t = setTimeout(() => setStatsVisible(false), 800);
    return () => clearTimeout(t);
  }, []);

  // Fire webhooks when we have data: full send (all rows) or retry-only-missing
  useEffect(() => {
    if (!reviewData?.tableData?.rows?.length) return;

    const sentKey = getMatchingSentKey(reviewData);
    if (lastSentKeyRef.current !== sentKey) {
      lastSentKeyRef.current = sentKey;
      alreadySentDoneSyncedRef.current = false;
    }
    const alreadySent = typeof window !== 'undefined' && sessionStorage.getItem(MATCHING_SENT_KEY) === sentKey;
    const rows = reviewData.tableData.rows;
    const allItemRowsWithIndex = rows
      .map((row, rIdx) => ({ rIdx, row }))
      .filter(({ row }) => String(row['type'] ?? '').toUpperCase() !== 'REMARK');

    const fileId = getMatchingSentKey(reviewData);
    const fileName = reviewData.fileName ?? '';

    const runSend = (itemRowsToSend: { rIdx: number; row: Record<string, string> }[], setSentKeyWhenDone: boolean) => {
      alreadySentDoneSyncedRef.current = false;
      const itemIndices = new Set(itemRowsToSend.map(({ rIdx }) => rIdx));
      setSendingRowIndices(itemIndices);
      setWebhookStatus('sending');

      const removeSending = (rIdx: number) => {
        setSendingRowIndices((prev) => {
          const next = new Set(prev);
          next.delete(rIdx);
          return next;
        });
      };

      Promise.allSettled(
        itemRowsToSend.map(async ({ rIdx, row }) => {
          const payloadRows = buildMatchingPayloadRows(rows, row, fileId, fileName, isRemarkRow);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), MATCHING_REQUEST_TIMEOUT_MS);
          try {
            const response = await fetch(MATCHING_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows: payloadRows }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) return;
            const data = await response.json();
            const one = extractMatchResult(data);
            if (one) {
              setMatchResultsByRow((prev) => ({ ...prev, [rIdx]: one }));
              setSelectedMatchIndexByRow((prev) => ({ ...prev, [rIdx]: 0 }));
            }
          } catch {
            // Timeout, network error, or parse error: leave row without result, continue others
          } finally {
            removeSending(rIdx);
          }
        })
      ).then(() => {
        if (setSentKeyWhenDone) {
          try {
            sessionStorage.setItem(MATCHING_SENT_KEY, sentKey);
          } catch {}
        }
        setWebhookStatus((prev) => (prev === 'done' ? prev : 'done'));
      });
    };

    // Retry only rows that have no match result yet (user chose "rerun only missing")
    if (alreadySent && retryMissingTrigger > 0 && retryMissingTrigger !== lastRetryTriggerRef.current) {
      lastRetryTriggerRef.current = retryMissingTrigger;
      const missing = allItemRowsWithIndex.filter(({ rIdx }) => !matchResultsByRow[rIdx]);
      if (missing.length === 0) {
        setWebhookStatus((prev) => (prev === 'done' ? prev : 'done'));
        return;
      }
      runSend(missing, false);
      return;
    }

    if (alreadySent) {
      if (!alreadySentDoneSyncedRef.current) {
        alreadySentDoneSyncedRef.current = true;
        setWebhookStatus('done');
      }
      return;
    }

    if (allItemRowsWithIndex.length === 0) {
      setWebhookStatus((prev) => (prev === 'done' ? prev : 'done'));
      try {
        sessionStorage.setItem(MATCHING_SENT_KEY, sentKey);
      } catch {}
      return;
    }

    // Only start initial send once per rerunTrigger; runSend sets state and would otherwise re-run effect
    if (initialSendStartedForTriggerRef.current === rerunTrigger) return;
    initialSendStartedForTriggerRef.current = rerunTrigger;
    runSend(allItemRowsWithIndex, true);
  }, [reviewData, rerunTrigger, retryMissingTrigger]);

  if (reviewData === null) {
    return (
      <div className="p-6 w-full max-w-full">
        <div className="w-full max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Matching</h1>
          <div className="border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">Keine Daten gefunden.</p>
            <p className="text-sm text-gray-500 mb-6">
              Bitte zuerst auf der Review-Seite die Daten prüfen.
            </p>
            <Link
              href="/review"
              className="inline-flex px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
            >
              ← Zurück zur Prüfung
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { tableData, fileName } = reviewData;

  /** Rerun matching for all rows (clears results and sent key). */
  const handleRerunAll = () => {
    try {
      sessionStorage.removeItem(MATCHING_SENT_KEY);
      if (reviewData) {
        const sentKey = getMatchingSentKey(reviewData);
        sessionStorage.removeItem(MATCH_RESULTS_CACHE_PREFIX + sentKey);
        sessionStorage.removeItem(MATCH_SELECTION_CACHE_PREFIX + sentKey);
        sessionStorage.removeItem(MATCH_FALSCH_CACHE_PREFIX + sentKey);
      }
    } catch {}
    setMatchResultsByRow({});
    setSelectedMatchIndexByRow({});
    setKfeFalschGrundByRow({});
    setRerunTrigger((prev) => prev + 1);
  };

  /** Rerun matching only for rows that have no result yet (e.g. failed or timed out). */
  const handleRerunMissingOnly = () => {
    setRetryMissingTrigger((prev) => prev + 1);
  };

  const [rerunDropdownOpen, setRerunDropdownOpen] = useState(false);
  const rerunDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rerunDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (rerunDropdownRef.current && !rerunDropdownRef.current.contains(e.target as Node)) {
        setRerunDropdownOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [rerunDropdownOpen]);

  return (
    <div className="p-6 w-full max-w-full">
      <div className="w-full max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {webhookStatus === 'sending' ? 'Matching läuft...' : 'Matching'}
          </h1>
          <div className="relative inline-block" ref={rerunDropdownRef}>
            <div className="flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => !rerunDropdownOpen && webhookStatus !== 'sending' && setRerunDropdownOpen(true)}
                disabled={webhookStatus === 'sending'}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Matches erneut ausführen
              </button>
              <button
                type="button"
                onClick={() => webhookStatus !== 'sending' && setRerunDropdownOpen((o) => !o)}
                disabled={webhookStatus === 'sending'}
                className="inline-flex items-center px-2 py-2 text-gray-500 bg-white border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Optionen"
                aria-expanded={rerunDropdownOpen}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {rerunDropdownOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRerunDropdownOpen(false);
                      handleRerunAll();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Alle erneut ausführen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRerunDropdownOpen(false);
                      handleRerunMissingOnly();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Nur Zeilen ohne Ergebnis
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats section – slowly animates out (slide up + fade) */}
        <div
          className="overflow-hidden transition-all duration-700 ease-out"
          style={{
            opacity: statsVisible ? 1 : 0,
            maxHeight: statsVisible ? 200 : 0,
            marginBottom: statsVisible ? 24 : 0,
            transform: statsVisible ? 'translateY(0)' : 'translateY(-1rem)',
          }}
        >
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-2.5 bg-gray-100 rounded-lg">
                <span className="text-xs font-medium text-gray-500">Datei</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Hochgeladene Datei</p>
                <p className="text-xs text-gray-500 mt-0.5">{fileName}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 max-w-xs">
              <p className="text-2xl font-semibold text-gray-900">{tableData.rows.length}</p>
              <p className="text-xs text-gray-500 mt-1">Positionen gesamt</p>
            </div>
          </div>
        </div>

        {/* Data Table (same structure as Review + group headers; spinner in Technische Einschätzung & KFE/DF columns) */}
        {tableData.headers.length > 0 && tableData.rows.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-700">
                Konvertierte Daten ({tableData.rows.length} Zeilen)
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/review"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  ← Zurück zur Prüfung
                </Link>
                <button
                  type="button"
                  onClick={handleCopyTable}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                  title="Tabelle in Zwischenablage kopieren (z.B. in Google Sheets einfügen)"
                >
                  {tableCopied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {tableCopied ? 'Kopiert' : 'Tabelle kopieren'}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                  title="Als CSV-Datei herunterladen"
                >
                  <Download className="w-4 h-4" />
                  CSV exportieren
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-400 text-sm font-medium rounded-md cursor-not-allowed bg-gray-50"
                  title="GAEB-Export (noch nicht verfügbar)"
                >
                  <FileText className="w-4 h-4" />
                  GAEB exportieren
                </button>
              </div>
            </div>
            <div className="overflow-x-auto w-full min-w-0">
              <table className="text-sm border-collapse table-auto" style={{ minWidth: 'max-content' }}>
                <colgroup>
                  {(() => {
                    const cols: JSX.Element[] = [];
                    let lastGroup: ColumnGroup | null = null;
                    tableData.headers.forEach((h) => {
                      const group = getColumnGroup(h);
                      const isCollapsed = group ? isColumnGroupCollapsed(group) : false;
                      if (isCollapsed) {
                        // If this is the first column of a collapsed group, add placeholder col
                        if (group !== lastGroup) {
                          cols.push(<col key={`collapsed-${group}`} style={{ width: COL_MIN_DEFAULT, minWidth: COL_MIN_DEFAULT }} />);
                          lastGroup = group;
                        }
                        return;
                      }
                      if (group !== lastGroup) lastGroup = group;
                      if (LV_HEADER_KEYS.includes(h)) {
                        const w =
                          COMPACT_COLUMN_KEYS.has(h)
                            ? COL_MIN_COMPACT
                            : TEXT_COLUMN_KEYS.has(h)
                              ? TEXT_COLUMN_WIDTH
                              : COL_MIN_DEFAULT;
                        cols.push(<col key={h} style={{ width: w, minWidth: w }} />);
                      } else {
                        const w =
                          TEXT_COLUMN_KEYS.has(h)
                            ? TEXT_COLUMN_WIDTH
                            : KFE_MEDIUM_COLUMN_KEYS.has(h)
                              ? KFE_MEDIUM_WIDTH
                              : COL_MIN_DEFAULT;
                        cols.push(<col key={h} style={{ width: w, minWidth: w }} />);
                      }
                    });
                    return cols;
                  })()}
                  <col key="aktionen" style={{ width: 56, minWidth: 56 }} />
                </colgroup>
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  {/* Row 1: group headings – LV, Technische Einschätzung, KFE / DF, Aktionen */}
                  <tr>
                    {getGroupHeaders().map((g, i) => {
                      const groupName = g.label as ColumnGroup;
                      const isCollapsed = isColumnGroupCollapsed(groupName);
                      // Count visible columns for this group
                      const visibleCols = tableData.headers.filter((h) => getColumnGroup(h) === groupName).length;
                      // Find if there's a visible group before this one (for border-left)
                      const hasVisibleGroupBefore =
                        i > 0 &&
                        getGroupHeaders()
                          .slice(0, i)
                          .some((prevG) => {
                            const prevGroup = prevG.label as ColumnGroup;
                            return !isColumnGroupCollapsed(prevGroup);
                          });
                      return (
                        <th
                          key={i}
                          colSpan={isCollapsed ? 1 : visibleCols}
                          className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-100 transition-colors ${
                            hasVisibleGroupBefore || i > 0 ? 'border-l-2 border-l-gray-400' : ''
                          }`}
                          onClick={() => toggleColumnGroupCollapsed(groupName)}
                          title={isCollapsed ? 'Abschnitt einblenden' : 'Abschnitt ausblenden'}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            <span>{g.label}</span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-r border-gray-200 border-l-2 border-l-gray-400 cursor-default">
                      Aktionen
                    </th>
                  </tr>
                  {/* Row 2: subgroup headings – no background; LV and Technische Einschätzung empty */}
                  <tr>
                    {!isColumnGroupCollapsed('LV') && (
                      <th colSpan={11} className="px-3 py-0 border-r border-gray-200 bg-gray-50/80" />
                    )}
                    {!isColumnGroupCollapsed('Technische Einschätzung') && (
                      <th
                        colSpan={3}
                        className="px-3 py-0 border-r border-gray-200 bg-gray-50/80 border-l-2 border-l-gray-400"
                      />
                    )}
                    {!isColumnGroupCollapsed('KFE / DF') &&
                      getKfeSubgroupHeaders().map((sg, i) => (
                        <th
                          key={i}
                          colSpan={sg.colspan}
                          className={`px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-gray-200 last:border-r-0 ${
                            i === 0 ? 'border-l-2 border-l-gray-400' : ''
                          }`}
                        >
                          {sg.label}
                        </th>
                      ))}
                    <th className="px-3 py-0 border-r border-gray-200 bg-gray-50/80 border-l-2 border-l-gray-400" />
                  </tr>
                  {/* Row 3: column names */}
                  <tr>
                    {(() => {
                      const headerCells: JSX.Element[] = [];
                      let lastGroup: ColumnGroup | null = null;
                      tableData.headers.forEach((h, colIdx) => {
                        const group = getColumnGroup(h);
                        const isCollapsed = group ? isColumnGroupCollapsed(group) : false;
                        if (isCollapsed) {
                          // If this is the first column of a collapsed group, add placeholder
                          if (group !== lastGroup) {
                            headerCells.push(
                              <th
                                key={`collapsed-${group}`}
                                className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap border-r border-gray-100"
                              />
                            );
                            lastGroup = group;
                          }
                          return;
                        }
                        const isFirstInGroup = group !== lastGroup;
                        if (isFirstInGroup) lastGroup = group;
                        headerCells.push(
                          <th
                            key={h}
                            className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-100 last:border-r-0 ${
                              isFirstInGroup && colIdx > 0 ? 'border-l-2 border-l-gray-400' : ''
                            }`}
                          >
                            {tableData.labels?.[h] ?? h}
                          </th>
                        );
                      });
                      headerCells.push(
                        <th
                          key="aktionen"
                          className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-100 border-l-2 border-l-gray-400"
                        >
                          Aktionen
                        </th>
                      );
                      return headerCells;
                    })()}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableData.rows.map((row, rIdx) => {
                    const rowExpanded = isRowExpanded(rIdx);
                    const remarkRow = isRemarkRow(row);
                    const isThisRowSending = sendingRowIndices.has(rIdx);
                    const hidden = isRowInCollapsedSection(rIdx);
                    const isSectionHeader = remarkRow && sectionHasChildren(rIdx);
                    const isCollapsed = isSectionHeader && collapsedSections.has(rIdx);
                    const indentPx = remarkRow
                      ? SECTION_INDENT_REMARK_PX
                      : getPathLevel(String(row['rNoPart'] ?? '')) * SECTION_INDENT_PER_LEVEL_PX;
                    if (hidden) return null;
                    const rowDone = !remarkRow && isRowDone(rIdx);
                    return (
                      <tr
                        key={rIdx}
                        className={`${remarkRow ? 'bg-gray-100 hover:bg-gray-200' : rowDone ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-100'} ${
                          isSectionHeader ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={isSectionHeader ? () => toggleSectionCollapsed(rIdx) : undefined}
                      >
                        {(() => {
                          const cells: JSX.Element[] = [];
                          let lastGroup: ColumnGroup | null = null;
                          tableData.headers.forEach((key, colIdx) => {
                            const group = getColumnGroup(key);
                            const isCollapsed = group ? isColumnGroupCollapsed(group) : false;
                            if (isCollapsed) {
                              // If this is the first column of a collapsed group, add placeholder cell
                              if (group !== lastGroup) {
                                cells.push(
                                  <td
                                    key={`collapsed-${group}`}
                                    className="px-3 py-2 bg-gray-50 border-r border-gray-200"
                                  />
                                );
                                lastGroup = group;
                              }
                              return;
                            }
                            if (group !== lastGroup) lastGroup = group;

                            const isMatchingCol = MATCHING_SECTION_KEYS.has(key);
                            const showSpinner = isMatchingCol && isThisRowSending;
                            const matchResult = !remarkRow ? matchResultsByRow[rIdx] : undefined;
                            const hasMatch = Boolean(matchResult);
                            const kfeDf = hasMatch ? getKfeDfForRow(rIdx) : null;
                            const selectedMatchIdx = selectedMatchIndexByRow[rIdx] ?? 0;
                            const matchOptions = hasMatch ? getMatchOptions(rIdx) : [];
                            const showFalschGrund = hasMatch && selectedMatchIdx !== 0;
                            const falschGrundValue = kfeFalschGrundByRow[rIdx] ?? KFE_FALSCH_GRUND_OPTIONS[0];

                            let displayText = showSpinner ? '' : String(row[key] ?? '');
                            if (hasMatch && isMatchingCol && !showSpinner) {
                              if (key === 'kfeDfId') displayText = kfeDf!.idWithScore || kfeDf!.id;
                              else if (key === 'kfeDfKurztext') displayText = kfeDf!.kurztext;
                              else if (key === 'kfeDfLangtext') displayText = kfeDf!.langtext;
                              else if (key === 'kfeDfZeit') displayText = kfeDf!.zeit;
                              else if (key === 'kfeDfMaterialkosten') displayText = kfeDf!.materialkosten;
                              else if (key === 'kfeDfKategorie') displayText = kfeDf!.kategorie;
                              else if (key === 'kfeFalschGrund') displayText = showFalschGrund ? falschGrundValue : '';
                            }

                            const long = !showSpinner && isLong(displayText);
                            const isFirstCol = colIdx === 0;
                            const isFirstInGroup = isFirstColumnInGroup(key, tableData.headers);

                            const isKfeDfId = key === 'kfeDfId';
                            const isKfeFalschGrund = key === 'kfeFalschGrund';
                            const isEditingThis = editingCell?.rIdx === rIdx && editingCell?.key === key;

                            cells.push(
                            <td
                              key={key}
                              className={`group px-3 py-2 text-gray-900 align-top transition-colors ${
                                rowExpanded ? 'whitespace-normal break-words' : 'whitespace-nowrap truncate'
                              } hover:bg-gray-200 ${remarkRow ? 'hover:bg-gray-300' : ''} ${
                                isFirstCol && remarkRow ? 'border-l-2 border-gray-400' : ''
                              } ${isFirstInGroup && !isFirstCol ? 'border-l-2 border-l-gray-400' : ''} ${
                                TEXT_COLUMN_KEYS.has(key) ? 'max-w-[220px]' : ''
                              }`}
                              title={rowExpanded && !isEditingThis ? undefined : displayText}
                              style={{ minWidth: 0, paddingLeft: isFirstCol ? 8 + indentPx : undefined }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (!showSpinner) startEditCell(rIdx, key, displayText);
                              }}
                            >
                              <div className="flex items-start justify-between gap-1 min-w-0">
                                {isEditingThis ? (
                                  <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={saveEditCell}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditCell();
                                      if (e.key === 'Escape') cancelEditCell();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                                    autoFocus
                                  />
                                ) : showSpinner ? (
                                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
                                ) : isKfeDfId && hasMatch && matchOptions.length > 0 && !isEditingThis ? (
                                  <span className="flex flex-col gap-1 min-w-0 flex-1">
                                    <select
                                      value={selectedMatchIdx}
                                      onChange={(e) => setSelectedMatch(rIdx, Number(e.target.value))}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full max-w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white truncate"
                                      title="KFE ID auswählen"
                                    >
                                      {matchOptions.map((opt) => (
                                        <option key={opt.index} value={opt.index}>
                                          {opt.idWithScore || opt.id || '—'}
                                        </option>
                                      ))}
                                    </select>
                                    <span className={`min-w-0 text-gray-500 text-xs ${rowExpanded ? '' : 'truncate block'}`}>
                                      {kfeDf!.kurztext || '—'}
                                    </span>
                                  </span>
                                ) : isKfeFalschGrund && showFalschGrund && !isEditingThis ? (
                                  <select
                                    value={falschGrundValue}
                                    onChange={(e) =>
                                      setKfeFalschGrundByRow((prev) => ({ ...prev, [rIdx]: e.target.value }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full max-w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                                    title="KFE Falsch Grund"
                                  >
                                    {KFE_FALSCH_GRUND_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : isFirstCol && isSectionHeader ? (
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    {isCollapsed ? (
                                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    )}
                                    <span className={`min-w-0 flex-1 ${rowExpanded ? '' : 'truncate block'}`}>
                                      {displayText || '—'}
                                    </span>
                                  </span>
                                ) : (
                                  <span className={`min-w-0 flex-1 ${rowExpanded ? '' : 'truncate block'}`}>
                                    {displayText || '—'}
                                  </span>
                                )}
                                {!showSpinner && !isEditingThis && !isKfeDfId && !(isKfeFalschGrund && showFalschGrund) && (
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    {long && key !== 'id' ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpandRow(rIdx);
                                        }}
                                        className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                                        title={rowExpanded ? 'Zeile einklappen' : 'Zeile erweitern'}
                                        aria-label={rowExpanded ? 'Collapse row' : 'Expand row'}
                                      >
                                        {rowExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyCell(displayText, rIdx, key);
                                      }}
                                      className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-opacity opacity-0 group-hover:opacity-100"
                                      title="In Zwischenablage kopieren"
                                      aria-label="Copy"
                                    >
                                      {copiedCellId === copyCellId(rIdx, key) ? (
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            );
                          });
                          return cells;
                        })()}
                        <td
                          key="aktionen"
                          className="px-3 py-2 border-r border-gray-200 border-l-2 border-l-gray-400 align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!remarkRow ? (
                            <button
                              type="button"
                              onClick={() => toggleDoneRow(rIdx)}
                              title={rowDone ? 'Als nicht erledigt markieren' : 'Als erledigt markieren'}
                              className={`p-1.5 rounded transition-colors ${
                                rowDone
                                  ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                  : 'text-gray-400 hover:text-green-600 hover:bg-gray-100'
                              }`}
                              aria-label={rowDone ? 'Erledigt' : 'Als erledigt markieren'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {webhookStatus === 'sending' && (
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td
                        colSpan={tableData.headers.length + 1}
                        className="px-4 py-4 text-center text-sm text-gray-600"
                      >
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="w-5 h-5 text-gray-500 animate-spin flex-shrink-0" />
                          <span>Daten werden an den Matching-Service gesendet…</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {webhookStatus === 'done' && (
                    <tr className="bg-green-50 border-t border-gray-200">
                      <td colSpan={tableData.headers.length + 1} className="px-4 py-3 text-center text-sm text-green-700">
                        Gesendet.
                      </td>
                    </tr>
                  )}
                  {webhookStatus === 'error' && (
                    <tr className="bg-red-50 border-t border-gray-200">
                      <td colSpan={tableData.headers.length + 1} className="px-4 py-3 text-center text-sm text-red-700">
                        Fehler beim Senden. Bitte erneut versuchen.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
