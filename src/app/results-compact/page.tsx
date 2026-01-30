'use client';

import { useState } from 'react';
import { Clock, FileText, Plus, Pencil, Check, Trash2, AlertTriangle } from 'lucide-react';

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

const tableData = [
  {
    id: '1',
    kfeCode: 'KFE 23.21.01',
    matchedService: 'Wandfliesen 20x25cm weiß, Dünnbett verlegt',
    confidence: 94,
    confidenceLevel: 'high' as const,
    qty: 125.5,
    laborHours: 31.4,
    laborCost: 1884.00,
    material: 4202.75,
    total: 6086.75,
    hasWarning: false,
  },
  {
    id: '2',
    kfeCode: 'KFE 23.21.02',
    matchedService: 'Bodenfliesen 30x30cm Feinsteinzeug R10',
    confidence: 78,
    confidenceLevel: 'medium' as const,
    qty: 89.0,
    laborHours: 26.7,
    laborCost: 1602.00,
    material: 3942.70,
    total: 5544.70,
    hasWarning: true,
  },
  {
    id: '3',
    kfeCode: null,
    matchedService: null,
    confidence: 45,
    confidenceLevel: 'low' as const,
    qty: 34.2,
    laborHours: 8.6,
    laborCost: 516.00,
    material: 130.38,
    total: 646.38,
    hasWarning: true,
  },
];

export default function ResultsCompactPage() {
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');

  const filteredData = tableData.filter((row) => {
    if (confidenceFilter === 'all') return true;
    return row.confidenceLevel === confidenceFilter;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Project Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Project: Office Building
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Matching complete • Ready for review
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                History
              </span>
            </button>
            <button className="px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Export GAEB
              </span>
            </button>
            <button className="px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Export PDF
              </span>
            </button>
            <button className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
              Save Changes
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Filter by Confidence:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfidenceFilter('all')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  confidenceFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setConfidenceFilter('high')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  confidenceFilter === 'high'
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                High (90%+)
              </button>
              <button
                onClick={() => setConfidenceFilter('medium')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  confidenceFilter === 'medium'
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Medium (70-89%)
              </button>
              <button
                onClick={() => setConfidenceFilter('low')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  confidenceFilter === 'low'
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Low (&lt;70%)
              </button>
            </div>
          </div>

          <button className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>

        {/* Compact Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Matched Service
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">
                  Confidence
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-16">
                  Qty
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">
                  Labor (h)
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">
                  Labor Cost
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">
                  Material
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">
                  Total
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    index !== filteredData.length - 1 ? 'border-b border-gray-200' : ''
                  }`}
                >
                  {/* Matched Service */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.kfeCode ? (
                        <>
                          <span className="inline-flex px-1.5 py-0.5 text-xs font-mono border border-gray-200 text-gray-600 rounded bg-white">
                            {row.kfeCode}
                          </span>
                          <Pencil className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-900 truncate">
                            {row.matchedService}
                          </span>
                        </>
                      ) : (
                        <button className="text-xs text-gray-600 hover:underline">
                          Assign Service
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                          row.confidenceLevel === 'high'
                            ? 'bg-green-100'
                            : row.confidenceLevel === 'medium'
                            ? 'bg-amber-100'
                            : 'bg-red-100'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full ${
                            row.confidenceLevel === 'high'
                              ? 'bg-green-600'
                              : row.confidenceLevel === 'medium'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${row.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums w-7 text-right">
                        {row.confidence}%
                      </span>
                    </div>
                  </td>

                  {/* Qty */}
                  <td className="px-3 py-2 text-sm text-gray-900 text-right tabular-nums">
                    {formatNumber(row.qty)}
                  </td>

                  {/* Labor Hours */}
                  <td className="px-3 py-2 text-sm text-gray-900 text-right tabular-nums">
                    {formatNumber(row.laborHours)}
                  </td>

                  {/* Labor Cost */}
                  <td className="px-3 py-2 text-sm text-gray-900 text-right tabular-nums">
                    €{formatCurrency(row.laborCost)}
                  </td>

                  {/* Material */}
                  <td className="px-3 py-2 text-sm text-gray-900 text-right tabular-nums">
                    €{formatCurrency(row.material)}
                  </td>

                  {/* Total */}
                  <td className="px-3 py-2 text-sm text-gray-900 text-right tabular-nums font-medium">
                    <div className="flex items-center justify-end gap-1">
                      {row.hasWarning && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      )}
                      €{formatCurrency(row.total)}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1 text-gray-400 hover:text-green-600 transition-colors">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Row */}
        <div className="mt-3 flex justify-end">
          <div className="text-xs text-gray-500">
            Showing <span className="font-medium text-gray-700">{filteredData.length}</span> of{' '}
            <span className="font-medium text-gray-700">{tableData.length}</span> items
          </div>
        </div>
      </div>
    </div>
  );
}
