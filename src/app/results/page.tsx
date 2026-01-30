'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, FileText, Check, X, Plus } from 'lucide-react';

const steps = [
  { number: 1, label: 'Upload', href: '/' },
  { number: 2, label: 'Review', href: '/review' },
  { number: 3, label: 'Matching', href: '/matching' },
  { number: 4, label: 'Results & Review', href: '/results' },
];

const currentStep = 4;

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

const tableData = [
  {
    id: '1',
    selected: true,
    kfeCode: 'KFE 23.21.01',
    description: 'Wandfliesen 20x25cm weiß, Dünnbett verlegt inkl. Fugenmörtel',
    confidence: 94,
    confidenceLevel: 'high' as const,
    qty: 125.5,
    unit: 'm²',
    unitPrice: 48.50,
    total: 6086.75,
  },
  {
    id: '2',
    selected: true,
    kfeCode: 'KFE 23.21.02',
    description: 'Bodenfliesen 30x30cm Feinsteinzeug R10, Mittelbett inkl. Grundierung',
    confidence: 78,
    confidenceLevel: 'medium' as const,
    qty: 89.0,
    unit: 'm²',
    unitPrice: 62.30,
    total: 5544.70,
  },
  {
    id: '3',
    selected: false,
    kfeCode: 'KFE 23.45.03',
    description: 'Sockelleisten Aluminium 60mm eloxiert, inkl. Befestigung',
    confidence: 45,
    confidenceLevel: 'low' as const,
    qty: 34.2,
    unit: 'lfm',
    unitPrice: 18.90,
    total: 646.38,
  },
];

export default function ResultsPage() {
  const [selectedRows, setSelectedRows] = useState<string[]>(['1', '2']);
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');

  const toggleRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleAllRows = () => {
    if (selectedRows.length === tableData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(tableData.map((row) => row.id));
    }
  };

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

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Progress Tabs */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((step) => (
            <Link
              key={step.number}
              href={step.href}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                step.number === currentStep
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {step.number}. {step.label}
            </Link>
          ))}
        </div>

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

        {/* Cost Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Material Costs</p>
            <p className="text-2xl font-semibold text-gray-900">€24,892.50</p>
            <p className="text-xs text-green-600 mt-1">Adjusts live ✓</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Labour Costs</p>
            <p className="text-2xl font-semibold text-gray-900">€18,450.00</p>
            <p className="text-xs text-green-600 mt-1">Adjusts live ✓</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total Net</p>
            <p className="text-2xl font-semibold text-gray-900">€43,342.50</p>
            <p className="text-xs text-green-600 mt-1">Adjusts live ✓</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Margin (15%)</p>
            <p className="text-2xl font-semibold text-gray-900">€6,501.38</p>
            <p className="text-xs text-green-600 mt-1">Adjusts live ✓</p>
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

        {/* Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === tableData.length}
                    onChange={toggleAllRows}
                    className="w-4 h-4 border-gray-300 rounded text-gray-900 focus:ring-gray-900"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KFE Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Confidence
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row.id)}
                      onChange={() => toggleRow(row.id)}
                      className="w-4 h-4 border-gray-300 rounded text-gray-900 focus:ring-gray-900"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs border border-gray-200 text-gray-700 rounded">
                      {row.kfeCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                    {row.description}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 h-2 rounded-full overflow-hidden ${
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
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${row.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">
                        {row.confidence}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                    {formatCurrency(row.qty)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-center">
                    {row.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                    €{formatCurrency(row.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium tabular-nums">
                    €{formatCurrency(row.total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1 text-green-600 hover:text-green-700 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Row */}
        <div className="mt-4 flex justify-end">
          <div className="text-sm text-gray-600">
            Showing <span className="font-medium text-gray-900">{filteredData.length}</span> of{' '}
            <span className="font-medium text-gray-900">{tableData.length}</span> items •{' '}
            <span className="font-medium text-gray-900">{selectedRows.length}</span> selected
          </div>
        </div>
      </div>
    </div>
  );
}
