'use client';

import { ChevronDown, ChevronUp, ChevronRight, Loader2, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import {
  LV_HEADER_KEYS,
  COMPACT_COLUMN_KEYS,
  TEXT_COLUMN_KEYS,
  KFE_MEDIUM_COLUMN_KEYS,
  MATCHING_SECTION_KEYS,
  getGroupHeaders,
  getKfeSubgroupHeaders,
  getPathLevel,
  buildSectionStartByRowIndex,
  buildSectionRanges,
  SECTION_INDENT_REMARK_PX,
  SECTION_INDENT_PER_LEVEL_PX,
} from '@/lib/table-columns';

const EXPAND_THRESHOLD = 35;
const REVIEW_STORAGE_KEY = 'tawo_review_data';
const MATCHING_SENT_KEY = 'tawo_matching_sent';

/** Stable key for current dataset so we don't resend on revisit. */
function getMatchingSentKey(data: ReviewData): string {
  const rows = data?.tableData?.rows;
  const firstId = rows?.[0]?.['id'] ?? '';
  return `${data.fileName ?? ''}-${rows?.length ?? 0}-${firstId}`;
}

const COL_MIN_COMPACT = 36;
const TEXT_COLUMN_WIDTH = 220;
/** KFE columns (main focus): text ones 220, ID/Zeit/Falsch Grund/Fit get medium width. */
const KFE_MEDIUM_WIDTH = 140;
const COL_MIN_DEFAULT = 56;

const MATCHING_API_URL = '/api/matching-webhook';

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

export default function MatchingPage() {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [statsVisible, setStatsVisible] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [sendingRowIndex, setSendingRowIndex] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null);

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
        }
      }
    } catch {
      setReviewData(null);
    }
  }, []);

  // Slowly hide the stats section after mount
  useEffect(() => {
    const t = setTimeout(() => setStatsVisible(false), 800);
    return () => clearTimeout(t);
  }, []);

  // Fire webhooks when we have data: one row at a time, production only, 0.1s between each request
  useEffect(() => {
    if (!reviewData?.tableData?.rows?.length) return;

    const sentKey = getMatchingSentKey(reviewData);
    const alreadySent = typeof window !== 'undefined' && sessionStorage.getItem(MATCHING_SENT_KEY) === sentKey;

    if (alreadySent) {
      setWebhookStatus('done');
      return;
    }

    const rows = reviewData.tableData.rows;
    const itemRowsWithIndex = rows
      .map((row, rIdx) => ({ rIdx, row }))
      .filter(({ row }) => String(row['type'] ?? '').toUpperCase() !== 'REMARK');

    if (itemRowsWithIndex.length === 0) {
      setWebhookStatus('done');
      try {
        sessionStorage.setItem(MATCHING_SENT_KEY, sentKey);
      } catch {}
      return;
    }

    setWebhookStatus('sending');

    const run = async () => {
      try {
        for (let i = 0; i < itemRowsWithIndex.length; i++) {
          const { rIdx, row } = itemRowsWithIndex[i];
          setSendingRowIndex(rIdx);

          const response = await fetch(MATCHING_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: [row] }),
          });

          if (!response.ok) {
            setWebhookStatus('error');
            setSendingRowIndex(null);
            return;
          }

          if (i < itemRowsWithIndex.length - 1) {
            await new Promise((r) => setTimeout(r, 100));
          }
        }
        setSendingRowIndex(null);
        try {
          sessionStorage.setItem(MATCHING_SENT_KEY, sentKey);
        } catch {}
        setWebhookStatus('done');
      } catch {
        setWebhookStatus('error');
        setSendingRowIndex(null);
      }
    };
    run();
  }, [reviewData]);

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

  return (
    <div className="p-6 w-full max-w-full">
      <div className="w-full max-w-full">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Matching läuft...</h1>

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
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700">
                Konvertierte Daten ({tableData.rows.length} Zeilen)
              </p>
            </div>
            <div className="overflow-auto max-h-[60vh] w-full min-w-0" style={{ overflowX: 'auto' }}>
              <table className="text-sm border-collapse table-auto" style={{ minWidth: 'max-content' }}>
                <colgroup>
                  {tableData.headers.map((h) => {
                    if (LV_HEADER_KEYS.includes(h)) {
                      return (
                        <col
                          key={h}
                          style={{
                            minWidth: COMPACT_COLUMN_KEYS.has(h)
                              ? COL_MIN_COMPACT
                              : TEXT_COLUMN_KEYS.has(h)
                                ? TEXT_COLUMN_WIDTH
                                : COL_MIN_DEFAULT,
                          }}
                        />
                      );
                    }
                    const w =
                      TEXT_COLUMN_KEYS.has(h)
                        ? TEXT_COLUMN_WIDTH
                        : KFE_MEDIUM_COLUMN_KEYS.has(h)
                          ? KFE_MEDIUM_WIDTH
                          : COL_MIN_DEFAULT;
                    return <col key={h} style={{ width: w, minWidth: w }} />;
                  })}
                </colgroup>
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  {/* Row 1: group headings – LV, Technische Einschätzung, KFE / DF */}
                  <tr>
                    {getGroupHeaders().map((g, i) => (
                      <th key={i} colSpan={g.colspan} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-r border-gray-200 last:border-r-0">
                        {g.label}
                      </th>
                    ))}
                  </tr>
                  {/* Row 2: subgroup headings – no background; LV and Technische Einschätzung empty */}
                  <tr>
                    <th colSpan={11} className="px-3 py-0 border-r border-gray-200 bg-gray-50/80" />
                    <th colSpan={3} className="px-3 py-0 border-r border-gray-200 bg-gray-50/80" />
                    {getKfeSubgroupHeaders().map((sg, i) => (
                      <th key={i} colSpan={sg.colspan} className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-gray-200 last:border-r-0">
                        {sg.label}
                      </th>
                    ))}
                  </tr>
                  {/* Row 3: column names for all 21 columns */}
                  <tr>
                    {tableData.headers.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-100 last:border-r-0"
                      >
                        {tableData.labels?.[h] ?? h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableData.rows.map((row, rIdx) => {
                    const rowExpanded = isRowExpanded(rIdx);
                    const remarkRow = isRemarkRow(row);
                    const isThisRowSending = sendingRowIndex === rIdx;
                    const hidden = isRowInCollapsedSection(rIdx);
                    const isSectionHeader = remarkRow && sectionHasChildren(rIdx);
                    const isCollapsed = isSectionHeader && collapsedSections.has(rIdx);
                    const indentPx = remarkRow
                      ? SECTION_INDENT_REMARK_PX
                      : getPathLevel(String(row['rNoPart'] ?? '')) * SECTION_INDENT_PER_LEVEL_PX;
                    if (hidden) return null;
                    return (
                      <tr
                        key={rIdx}
                        className={`${remarkRow ? 'bg-gray-100 hover:bg-gray-200' : 'hover:bg-gray-100'} ${
                          isSectionHeader ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={isSectionHeader ? () => toggleSectionCollapsed(rIdx) : undefined}
                      >
                        {tableData.headers.map((key, colIdx) => {
                          const isMatchingCol = MATCHING_SECTION_KEYS.has(key);
                          const showSpinner = isMatchingCol && isThisRowSending;
                          const text = showSpinner ? '' : String(row[key] ?? '');
                          const long = !showSpinner && isLong(text);
                          const isFirstCol = colIdx === 0;
                          return (
                            <td
                              key={key}
                              className={`group px-3 py-2 text-gray-900 align-top transition-colors ${
                                rowExpanded ? 'whitespace-normal break-words' : 'whitespace-nowrap truncate'
                              } hover:bg-gray-200 ${remarkRow ? 'hover:bg-gray-300' : ''} ${
                                isFirstCol && remarkRow ? 'border-l-2 border-gray-400' : ''
                              }`}
                              title={rowExpanded ? undefined : text}
                              style={{ minWidth: 0, paddingLeft: isFirstCol ? 8 + indentPx : undefined }}
                            >
                              <div className="flex items-start justify-between gap-1 min-w-0">
                                {showSpinner ? (
                                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
                                ) : isFirstCol && isSectionHeader ? (
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    {isCollapsed ? (
                                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    )}
                                    <span className={`min-w-0 flex-1 ${rowExpanded ? '' : 'truncate block'}`}>
                                      {text || '—'}
                                    </span>
                                  </span>
                                ) : (
                                  <span className={`min-w-0 flex-1 ${rowExpanded ? '' : 'truncate block'}`}>
                                    {text || '—'}
                                  </span>
                                )}
                                {!showSpinner && (
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
                                        handleCopyCell(text, rIdx, key);
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
                        })}
                      </tr>
                    );
                  })}
                  {webhookStatus === 'sending' && (
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td
                        colSpan={tableData.headers.length}
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
                      <td colSpan={tableData.headers.length} className="px-4 py-3 text-center text-sm text-green-700">
                        Gesendet.
                      </td>
                    </tr>
                  )}
                  {webhookStatus === 'error' && (
                    <tr className="bg-red-50 border-t border-gray-200">
                      <td colSpan={tableData.headers.length} className="px-4 py-3 text-center text-sm text-red-700">
                        Fehler beim Senden. Bitte erneut versuchen.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link
            href="/review"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Zurück zur Prüfung
          </Link>
          <Link
            href="/results-compact"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            Zu den Ergebnissen →
          </Link>
        </div>
      </div>
    </div>
  );
}
