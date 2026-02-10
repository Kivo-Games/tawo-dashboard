'use client';

import { FileText, ChevronDown, ChevronUp, ChevronRight, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import {
  COMPACT_COLUMN_KEYS,
  TEXT_COLUMN_KEYS,
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

/** Min width so table fits without horizontal scroll at start (compact and text columns). */
const COL_MIN_COMPACT = 36;
const COL_MIN_TEXT = 72;
const COL_MIN_DEFAULT = 56;

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

export default function ReviewPage() {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null);

  const copyCellId = (rIdx: number, key: string) => `${rIdx}-${key}`;
  const handleCopyCell = async (text: string, rIdx: number, key: string) => {
    const toCopy = text || '';
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
  const isRemarkRow = (row: Record<string, string>) => String(row['type'] ?? '').toUpperCase() === 'REMARK';

  const rows = reviewData?.tableData?.rows ?? [];
  const sectionStartByRow = useMemo(
    () => buildSectionStartByRowIndex(rows, isRemarkRow),
    [rows]
  );
  const sectionRanges = useMemo(
    () => buildSectionRanges(rows, isRemarkRow),
    [rows]
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

  if (reviewData === null) {
    return (
      <div className="p-6 w-full max-w-full">
        <div className="w-full max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">
            Upload prüfen & Matching starten
          </h1>
          <div className="border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">Keine Upload-Daten gefunden.</p>
            <p className="text-sm text-gray-500 mb-6">
              Laden Sie eine GAEB-Datei auf der Projekt-Seite hoch, um fortzufahren.
            </p>
            <Link
              href="/"
              className="inline-flex px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
            >
              ← Zurück zum Upload
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { tableData, fileName } = reviewData;
  const totalLineItems = tableData.rows.length;

  return (
    <div className="p-6 w-full max-w-full">
      <div className="w-full max-w-full">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Upload prüfen & Matching starten
        </h1>

        {/* Uploaded File Card */}
        <div className="border border-gray-200 rounded-lg p-5 mb-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2.5 bg-gray-100 rounded-lg">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Hochgeladene Datei</p>
              <p className="text-xs text-gray-500 mt-0.5">{fileName}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 max-w-xs">
              <p className="text-2xl font-semibold text-gray-900">{totalLineItems}</p>
              <p className="text-xs text-gray-500 mt-1">Positionen gesamt</p>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {tableData.headers.length > 0 && tableData.rows.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700">
                Konvertierte Daten ({tableData.rows.length} Zeilen)
              </p>
            </div>
            <div className="overflow-auto max-h-[60vh] w-full min-w-0" style={{ overflowX: 'auto' }}>
              <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: 0 }}>
                <colgroup>
                  {tableData.headers.map((h) => (
                    <col
                      key={h}
                      style={{
                        minWidth: COMPACT_COLUMN_KEYS.has(h) ? COL_MIN_COMPACT : TEXT_COLUMN_KEYS.has(h) ? COL_MIN_TEXT : COL_MIN_DEFAULT,
                      }}
                    />
                  ))}
                </colgroup>
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    {getGroupHeaders().map((g, i) => (
                      <th key={i} colSpan={g.colspan} className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 border-r border-gray-200 last:border-r-0">
                        {g.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th colSpan={11} className="px-2 py-0 border-r border-gray-200 bg-gray-50/80" />
                    <th colSpan={3} className="px-2 py-0 border-r border-gray-200 bg-gray-50/80" />
                    {getKfeSubgroupHeaders().map((sg, i) => (
                      <th key={i} colSpan={sg.colspan} className="px-2 py-1 text-left text-xs font-medium text-gray-500 border-r border-gray-200 last:border-r-0 bg-gray-50/80">
                        {sg.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {tableData.headers.map((h) => (
                      <th
                        key={h}
                        className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-100 last:border-r-0"
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
                    const hidden = isRowInCollapsedSection(rIdx);
                    const sectionStart = sectionStartByRow[rIdx];
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
                          const text = String(row[key] ?? '');
                          const long = isLong(text);
                          const isFirstCol = colIdx === 0;
                          return (
                            <td
                              key={key}
                              className={`group px-2 py-1.5 text-gray-900 align-top transition-colors ${
                                rowExpanded ? 'whitespace-normal break-words' : 'whitespace-nowrap truncate'
                              } hover:bg-gray-200 ${remarkRow ? 'hover:bg-gray-300' : ''} ${
                                isFirstCol && remarkRow ? 'border-l-2 border-gray-400' : ''
                              }`}
                              title={rowExpanded ? undefined : text}
                              style={{ minWidth: 0, paddingLeft: isFirstCol ? 8 + indentPx : undefined }}
                            >
                              <div className="flex items-start justify-between gap-1 min-w-0">
                                {isFirstCol && isSectionHeader ? (
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
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Zurück zum Upload
          </Link>
          <Link
            href="/matching"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            Matching-Prozess starten →
          </Link>
        </div>
      </div>
    </div>
  );
}
