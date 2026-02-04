'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const EXPAND_THRESHOLD = 35;
const REVIEW_STORAGE_KEY = 'tawo_review_data';
const MATCHING_SENT_KEY = 'tawo_matching_sent';

/** Stable key for current dataset so we don't resend on revisit. */
function getMatchingSentKey(data: ReviewData): string {
  const rows = data?.tableData?.rows;
  const firstId = rows?.[0]?.['id'] ?? '';
  return `${data.fileName ?? ''}-${rows?.length ?? 0}-${firstId}`;
}

const COMPACT_COLUMN_KEYS = new Set([
  'type',
  'rNoPart',
  'pathNumbers',
  'qty',
  'unit',
  'ctlgId',
  'ctlgCode',
]);

const LONG_TEXT_COLUMN_WIDTH = 220;

/** Extra columns shown only on Matching page; empty until data is sent back. */
const MATCHING_EXTRA_COLUMNS: { key: string; label: string }[] = [
  { key: 'mengeH', label: 'Menge (h)' },
  { key: 'lohnH', label: 'Lohn (h)' },
  { key: 'lohnkosten', label: 'Lohnkosten' },
  { key: 'materialkosten', label: 'Materialkosten' },
  { key: 'gesamtkosten', label: 'Gesamtkosten' },
];

const WEBHOOK_URLS = [
  'https://tawo.app.n8n.cloud/webhook/87040d37-7862-4840-b723-1c156c00b2d4',
  'https://tawo.app.n8n.cloud/webhook-test/87040d37-7862-4840-b723-1c156c00b2d4',
];

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

  // Fire webhooks when we have data (once per dataset; persist so revisit doesn't resend)
  useEffect(() => {
    if (!reviewData?.tableData?.rows?.length) return;

    const sentKey = getMatchingSentKey(reviewData);
    const alreadySent = typeof window !== 'undefined' && sessionStorage.getItem(MATCHING_SENT_KEY) === sentKey;

    if (alreadySent) {
      setWebhookStatus('done');
      return;
    }

    setWebhookStatus('sending');
    const payload = { rows: reviewData.tableData.rows };

    const run = async () => {
      try {
        await fetch(WEBHOOK_URLS[0], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await new Promise((r) => setTimeout(r, 100));
        await fetch(WEBHOOK_URLS[1], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        try {
          sessionStorage.setItem(MATCHING_SENT_KEY, sentKey);
        } catch {}
        setWebhookStatus('done');
      } catch {
        setWebhookStatus('error');
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

        {/* Data Table (same as Review) */}
        {tableData.headers.length > 0 && tableData.rows.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
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
                  {MATCHING_EXTRA_COLUMNS.map((c) => (
                    <col key={c.key} style={{ width: 90 }} />
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
                    {MATCHING_EXTRA_COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-[90px]"
                      >
                        {c.label}
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
                        {/* Extra columns: loading spinner until data sent, then empty */}
                        {MATCHING_EXTRA_COLUMNS.map((c) => (
                          <td
                            key={c.key}
                            className="px-3 py-2 text-gray-500 align-top w-[90px] text-right"
                          >
                            {webhookStatus === 'sending' ? (
                              <Loader2 className="w-4 h-4 text-gray-400 animate-spin inline-block" />
                            ) : (
                              '—'
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {/* Loading row – shown while webhooks are in flight */}
                  {webhookStatus === 'sending' && (
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td
                        colSpan={tableData.headers.length + MATCHING_EXTRA_COLUMNS.length}
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
                      <td
                        colSpan={tableData.headers.length + MATCHING_EXTRA_COLUMNS.length}
                        className="px-4 py-3 text-center text-sm text-green-700"
                      >
                        Gesendet.
                      </td>
                    </tr>
                  )}
                  {webhookStatus === 'error' && (
                    <tr className="bg-red-50 border-t border-gray-200">
                      <td
                        colSpan={tableData.headers.length + MATCHING_EXTRA_COLUMNS.length}
                        className="px-4 py-3 text-center text-sm text-red-700"
                      >
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
