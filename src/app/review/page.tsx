'use client';

import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const EXPAND_THRESHOLD = 35; // show expand icon when content length exceeds this

const REVIEW_STORAGE_KEY = 'tawo_review_data';

/** Column keys that should be content-fitted (narrow); the rest share remaining width. */
const COMPACT_COLUMN_KEYS = new Set([
  'type',
  'rNoPart',
  'pathNumbers',
  'qty',
  'unit',
  'ctlgId',
  'ctlgCode',
]);

/** Fixed width for Long text column (not content-dependent). */
const LONG_TEXT_COLUMN_WIDTH = 220;

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
            <div className="overflow-auto max-h-[60vh] w-full">
              <table className="w-full text-sm border-collapse table-auto">
                <colgroup>
                  {tableData.headers.map((h) => (
                    <col
                      key={h}
                      className={COMPACT_COLUMN_KEYS.has(h) ? 'w-px' : undefined}
                      style={
                        COMPACT_COLUMN_KEYS.has(h)
                          ? { width: '1%' }
                          : h === 'longText'
                          ? { width: LONG_TEXT_COLUMN_WIDTH }
                          : undefined
                      }
                    />
                  ))}
                </colgroup>
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    {tableData.headers.map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                          COMPACT_COLUMN_KEYS.has(h) ? 'w-px' : ''
                        } ${h === 'longText' ? 'w-[220px] max-w-[220px]' : ''}`}
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
                    return (
                      <tr
                        key={rIdx}
                        className={`${remarkRow ? 'bg-gray-100' : ''} hover:bg-gray-50`}
                      >
                        {tableData.headers.map((key) => {
                          const text = String(row[key] ?? '');
                          const long = isLong(text);
                          return (
                            <td
                              key={key}
                              className={`px-3 py-2 text-gray-900 align-top ${
                                rowExpanded ? 'whitespace-normal break-words' : 'whitespace-nowrap truncate'
                              } ${COMPACT_COLUMN_KEYS.has(key) ? 'w-px' : ''} ${
                                key === 'longText' ? 'w-[220px] max-w-[220px]' : ''
                              }`}
                              title={rowExpanded ? undefined : text}
                            >
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <span className={`min-w-0 flex-1 ${rowExpanded ? '' : 'truncate block'}`}>
                                  {text || '—'}
                                </span>
                                {long ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandRow(rIdx)}
                                    className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors ml-1"
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
