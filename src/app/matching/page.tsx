'use client';

import { Check } from 'lucide-react';

export default function MatchingProgressPage() {
  const progress = 65;

  return (
    <div className="p-6">
      <div className="max-w-xl mx-auto">
        {/* Centered Content */}
        <div className="text-center mb-10">
          {/* Spinner */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Matching läuft...
          </h1>
          <p className="text-sm text-gray-500">
            KI analysiert Ihre GAEB-Datei und ordnet Leistungen zu
          </p>
        </div>

        {/* Progress Checklist */}
        <div className="space-y-4 mb-10">
          {/* Completed: Parsing GAEB structure */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span className="text-sm text-gray-900">GAEB-Struktur wird analysiert</span>
          </div>

          {/* Completed: Extracting line items */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span className="text-sm text-gray-900">
              Positionen werden extrahiert (247 gefunden)
            </span>
          </div>

          {/* In Progress: Matching against TAWO database */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
            <span className="text-sm font-medium text-gray-900">
              Abgleich mit TAWO-Datenbank...
            </span>
          </div>

          {/* Pending: Calculating costs */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
            </div>
            <span className="text-sm text-gray-400">
              Kosten & Konfidenzwerte berechnen
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gray-900 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">{progress}% abgeschlossen</p>
        </div>
      </div>
    </div>
  );
}
