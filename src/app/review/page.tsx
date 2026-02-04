'use client';

import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const EXPAND_THRESHOLD = 35; // show expand icon when content length exceeds this

const REVIEW_STORAGE_KEY = 'tawo_review_data';

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
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const cellId = (rIdx: number, key: string) => `${rIdx}-${key}`;
  const isExpanded = (rIdx: number, key: string) => expandedCell === cellId(rIdx, key);
  const isLong = (text: string) => text.length > EXPAND_THRESHOLD;
  const toggleExpand = (rIdx: number, key: string) => {
    setExpandedCell((prev) => (prev === cellId(rIdx, key) ? null : cellId(rIdx, key)));
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
            Review Upload & Start Matching
          </h1>
          <div className="border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">No upload data found.</p>
            <p className="text-sm text-gray-500 mb-6">
              Upload a GAEB file on the Create Project page to continue.
            </p>
            <Link
              href="/"
              className="inline-flex px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
            >
              ← Back to Upload
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
          Review Upload & Start Matching
        </h1>

        {/* Uploaded File Card */}
        <div className="border border-gray-200 rounded-lg p-5 mb-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2.5 bg-gray-100 rounded-lg">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Uploaded File</p>
              <p className="text-xs text-gray-500 mt-0.5">{fileName}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 max-w-xs">
              <p className="text-2xl font-semibold text-gray-900">{totalLineItems}</p>
              <p className="text-xs text-gray-500 mt-1">Total Line Items</p>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {tableData.headers.length > 0 && tableData.rows.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700">
                Converted data ({tableData.rows.length} rows)
              </p>
            </div>
            <div className="overflow-auto max-h-[60vh] w-full">
              <table className="w-full text-sm border-collapse table-fixed">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    {tableData.headers.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {tableData.labels?.[h] ?? h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableData.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-gray-50">
                      {tableData.headers.map((key) => {
                        const text = String(row[key] ?? '');
                        const long = isLong(text);
                        const expanded = isExpanded(rIdx, key);
                        return (
                          <td
                            key={key}
                            className={`px-3 py-2 text-gray-900 align-top ${
                              expanded ? 'whitespace-normal break-words' : 'whitespace-nowrap truncate'
                            }`}
                            title={expanded ? undefined : text}
                          >
                            <div className="flex items-start gap-1.5">
                              <span className={expanded ? '' : 'min-w-0 truncate block'}>{text || '—'}</span>
                              {long && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(rIdx, key)}
                                  className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                  title={expanded ? 'Collapse' : 'Expand to see full text'}
                                  aria-label={expanded ? 'Collapse' : 'Expand'}
                                >
                                  {expanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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
            ← Back to Upload
          </Link>
          <Link
            href="/matching"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            Start Matching Process →
          </Link>
        </div>
      </div>
    </div>
  );
}
