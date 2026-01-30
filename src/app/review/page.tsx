'use client';

import { FileText, AlertCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ReviewPage() {
  const [labourCost, setLabourCost] = useState('40');
  const [marginCategory, setMarginCategory] = useState('standard');

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        {/* Page Title */}
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
              <p className="text-xs text-gray-500 mt-0.5">
                2.4 MB • Uploaded just now
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-semibold text-gray-900">247</p>
              <p className="text-xs text-gray-500 mt-1">Total Line Items</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-semibold text-gray-900">12</p>
              <p className="text-xs text-gray-500 mt-1">Categories Found</p>
            </div>
          </div>
        </div>

        {/* Quick Settings Check */}
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-gray-900">Quick Settings Check</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="labourCost"
                className="block text-sm text-gray-700 mb-1.5"
              >
                Hourly Labour Cost (€)
              </label>
              <input
                type="text"
                id="labourCost"
                value={labourCost}
                onChange={(e) => setLabourCost(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-md text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="marginCategory"
                className="block text-sm text-gray-700 mb-1.5"
              >
                Required Margin Categories
              </label>
              <div className="relative">
                <select
                  id="marginCategory"
                  value={marginCategory}
                  onChange={(e) => setMarginCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-md text-sm appearance-none focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                >
                  <option value="standard">Standard (15%)</option>
                  <option value="premium">Premium (20%)</option>
                  <option value="economy">Economy (10%)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

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
