'use client';

import { useState } from 'react';
import { Clock, FileText, Plus, Pencil, Check, Trash2, X, ChevronDown } from 'lucide-react';

type RowData = {
  id: string;
  kfeCode: string | null;
  matchedService: string | null;
  qty: number;
  laborHours: number;
  laborCost: number;
  material: number;
  total: number;
};

type EditData = {
  qty: string;
  laborHours: string;
  laborCost: string;
  material: string;
  total: string;
  correctionReason: string;
  notes: string;
  // Rates per unit (calculated when editing starts)
  hoursPerUnit: number;
  materialPerUnit: number;
};

type SavedCorrection = {
  rowId: string;
  originalValues: Partial<RowData>;
  newValues: Partial<RowData>;
  correctionReason: string;
  notes: string;
  timestamp: string;
  userId: string;
};

const HOURLY_RATE = 60; // €/Stunde

const CORRECTION_REASONS = [
  'Falsche Leistung zugeordnet',
  'Bessere Übereinstimmung vorhanden',
  'Preisanpassung erforderlich',
  'Kundenspezifische Anforderung',
  'Leistung nicht im System',
];

const initialTableData: RowData[] = [
  {
    id: '1',
    kfeCode: 'KFE 23.21.01',
    matchedService: 'Wandfliesen 20x25cm weiß, Dünnbett verlegt',
    qty: 125.5,
    laborHours: 31.4,
    laborCost: 1884.00,
    material: 4202.75,
    total: 6086.75,
  },
  {
    id: '2',
    kfeCode: 'KFE 23.21.02',
    matchedService: 'Bodenfliesen 30x30cm Feinsteinzeug R10',
    qty: 89.0,
    laborHours: 26.7,
    laborCost: 1602.00,
    material: 3942.70,
    total: 5544.70,
  },
  {
    id: '3',
    kfeCode: null,
    matchedService: null,
    qty: 34.2,
    laborHours: 8.6,
    laborCost: 516.00,
    material: 130.38,
    total: 646.38,
  },
];

export default function ResultsCompactPage() {
  const [tableData, setTableData] = useState<RowData[]>(initialTableData);
  const [confirmedRows, setConfirmedRows] = useState<Set<string>>(new Set());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData>({
    qty: '',
    laborHours: '',
    laborCost: '',
    material: '',
    total: '',
    correctionReason: '',
    notes: '',
    hoursPerUnit: 0,
    materialPerUnit: 0,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedCorrections, setSavedCorrections] = useState<SavedCorrection[]>([]);

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

  const parseGermanNumber = (value: string): number => {
    // Convert German format (1.234,56) to standard number
    const normalized = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const formatInputValue = (value: number): string => {
    return value.toString().replace('.', ',');
  };

  const startEditing = (row: RowData) => {
    // Calculate rates per unit based on current values
    const hoursPerUnit = row.qty > 0 ? row.laborHours / row.qty : 0;
    const materialPerUnit = row.qty > 0 ? row.material / row.qty : 0;

    setEditingRowId(row.id);
    setEditData({
      qty: formatInputValue(row.qty),
      laborHours: formatInputValue(row.laborHours),
      laborCost: formatInputValue(row.laborHours * HOURLY_RATE),
      material: formatInputValue(row.material),
      total: formatInputValue((row.laborHours * HOURLY_RATE) + row.material),
      correctionReason: '',
      notes: '',
      hoursPerUnit,
      materialPerUnit,
    });
    setValidationError(null);
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setEditData({
      qty: '',
      laborHours: '',
      laborCost: '',
      material: '',
      total: '',
      correctionReason: '',
      notes: '',
      hoursPerUnit: 0,
      materialPerUnit: 0,
    });
    setValidationError(null);
  };

  const handleEditChange = (field: keyof EditData, value: string) => {
    const newEditData = { ...editData, [field]: value };

    // When Menge changes, recalculate laborHours and material based on rates per unit
    if (field === 'qty') {
      const qty = parseGermanNumber(value);
      const laborHours = qty * editData.hoursPerUnit;
      const material = qty * editData.materialPerUnit;
      newEditData.laborHours = formatInputValue(laborHours);
      newEditData.material = formatInputValue(material);
      newEditData.laborCost = formatInputValue(laborHours * HOURLY_RATE);
      newEditData.total = formatInputValue((laborHours * HOURLY_RATE) + material);
    }
    // When laborHours changes manually, recalculate laborCost
    else if (field === 'laborHours') {
      const laborHours = parseGermanNumber(value);
      newEditData.laborCost = formatInputValue(laborHours * HOURLY_RATE);
      const material = parseGermanNumber(newEditData.material);
      newEditData.total = formatInputValue((laborHours * HOURLY_RATE) + material);
    }
    // When material changes manually, recalculate total
    else if (field === 'material') {
      const laborCost = parseGermanNumber(newEditData.laborCost);
      const material = parseGermanNumber(value);
      newEditData.total = formatInputValue(laborCost + material);
    }

    setEditData(newEditData);
    setValidationError(null);
  };

  const validateAndSave = () => {
    // Validate correction reason
    if (!editData.correctionReason) {
      setValidationError('Bitte wählen Sie einen Korrekturgrund aus.');
      return;
    }

    // Validate numeric fields
    const numericFields = ['qty', 'laborHours', 'laborCost', 'material', 'total'] as const;
    for (const field of numericFields) {
      const value = parseGermanNumber(editData[field]);
      if (isNaN(value) || value < 0) {
        setValidationError(`Ungültiger Wert für ${field}. Bitte geben Sie eine gültige Zahl ein.`);
        return;
      }
    }

    // Find the row being edited
    const originalRow = tableData.find(r => r.id === editingRowId);
    if (!originalRow) return;

    // Create new values (laborCost and total are always calculated)
    const qty = parseGermanNumber(editData.qty);
    const laborHours = parseGermanNumber(editData.laborHours);
    const laborCost = laborHours * HOURLY_RATE;
    const material = parseGermanNumber(editData.material);
    const total = laborCost + material;
    const newValues = {
      qty,
      laborHours,
      laborCost,
      material,
      total,
    };

    // Save correction record
    const correction: SavedCorrection = {
      rowId: editingRowId!,
      originalValues: {
        qty: originalRow.qty,
        laborHours: originalRow.laborHours,
        laborCost: originalRow.laborCost,
        material: originalRow.material,
        total: originalRow.total,
      },
      newValues,
      correctionReason: editData.correctionReason,
      notes: editData.notes,
      timestamp: new Date().toISOString(),
      userId: 'current-user', // In production, get from auth context
    };

    setSavedCorrections(prev => [...prev, correction]);

    // Update table data
    setTableData(prev => prev.map(row =>
      row.id === editingRowId
        ? { ...row, ...newValues }
        : row
    ));

    // Log for debugging (in production, send to API)
    console.log('Korrektur gespeichert:', correction);

    // Exit edit mode
    cancelEditing();
  };

  const isEditing = (rowId: string) => editingRowId === rowId;

  const toggleConfirmed = (rowId: string) => {
    setConfirmedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const isConfirmed = (rowId: string) => confirmedRows.has(rowId);

  const deleteRow = (rowId: string) => {
    setTableData(prev => prev.filter(row => row.id !== rowId));
    // Also remove from confirmed set if it was confirmed
    setConfirmedRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(rowId);
      return newSet;
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Project Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Projekt: Bürogebäude
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Matching abgeschlossen • Bereit zur Überprüfung
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-4 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Verlauf
            </button>
            <button className="px-4 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              GAEB exportieren
            </button>
            <button className="px-4 py-1.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              PDF exportieren
            </button>
            <button className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
              Änderungen speichern
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end mb-4">
          <button className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Leistung hinzufügen
          </button>
        </div>

        {/* Compact Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Zugeordnete Leistung
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">
                  Menge
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">
                  Lohn (h)
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-28">
                  Lohnkosten
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-28">
                  Material
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-28">
                  Gesamt
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <>
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isEditing(row.id)
                        ? 'bg-amber-50'
                        : isConfirmed(row.id)
                        ? 'bg-green-50'
                        : 'hover:bg-gray-50'
                    } ${index !== tableData.length - 1 && !isEditing(row.id) ? 'border-b border-gray-200' : ''}`}
                  >
                    {/* Matched Service */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {row.kfeCode && (
                          <>
                            <span className="inline-flex px-1.5 py-0.5 text-xs font-mono border border-gray-200 text-gray-600 rounded bg-white">
                              {row.kfeCode}
                            </span>
                            <Pencil className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-900 truncate">
                              {row.matchedService}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="px-3 py-2 text-right">
                      {isEditing(row.id) ? (
                        <input
                          type="text"
                          value={editData.qty}
                          onChange={(e) => handleEditChange('qty', e.target.value)}
                          className="w-full px-2 py-1 text-sm text-right border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 tabular-nums">
                          {formatNumber(row.qty)}
                        </span>
                      )}
                    </td>

                    {/* Labor Hours */}
                    <td className="px-3 py-2 text-right">
                      {isEditing(row.id) ? (
                        <input
                          type="text"
                          value={editData.laborHours}
                          onChange={(e) => handleEditChange('laborHours', e.target.value)}
                          className="w-full px-2 py-1 text-sm text-right border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 tabular-nums">
                          {formatNumber(row.laborHours)}
                        </span>
                      )}
                    </td>

                    {/* Labor Cost (calculated: Lohn (h) × Stundensatz) */}
                    <td className="px-3 py-2 text-right">
                      {isEditing(row.id) ? (
                        <div className="flex items-center justify-end">
                          <span className="text-sm text-gray-500 mr-1">€</span>
                          <input
                            type="text"
                            value={editData.laborCost}
                            className="w-full px-2 py-1 text-sm text-right border border-gray-200 rounded bg-gray-100 text-gray-600"
                            readOnly
                            title={`Automatisch berechnet: Lohn (h) × ${HOURLY_RATE} €`}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-900 tabular-nums">
                          €{formatCurrency(row.laborHours * HOURLY_RATE)}
                        </span>
                      )}
                    </td>

                    {/* Material */}
                    <td className="px-3 py-2 text-right">
                      {isEditing(row.id) ? (
                        <div className="flex items-center justify-end">
                          <span className="text-sm text-gray-500 mr-1">€</span>
                          <input
                            type="text"
                            value={editData.material}
                            onChange={(e) => handleEditChange('material', e.target.value)}
                            className="w-full px-2 py-1 text-sm text-right border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-900 tabular-nums">
                          €{formatCurrency(row.material)}
                        </span>
                      )}
                    </td>

                    {/* Total (calculated: Lohnkosten + Material) */}
                    <td className="px-3 py-2 text-right">
                      {isEditing(row.id) ? (
                        <div className="flex items-center justify-end">
                          <span className="text-sm text-gray-500 mr-1">€</span>
                          <input
                            type="text"
                            value={editData.total}
                            className="w-full px-2 py-1 text-sm text-right border border-gray-200 rounded bg-gray-100 text-gray-600"
                            readOnly
                            title="Automatisch berechnet: Lohnkosten + Material"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-900 tabular-nums font-medium">
                          €{formatCurrency((row.laborHours * HOURLY_RATE) + row.material)}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing(row.id) ? (
                          <>
                            <button
                              onClick={validateAndSave}
                              className="p-1 text-green-600 hover:text-green-700 transition-colors"
                              title="Speichern"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1 text-red-500 hover:text-red-600 transition-colors"
                              title="Abbrechen"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => toggleConfirmed(row.id)}
                              className={`p-1 transition-colors ${
                                isConfirmed(row.id)
                                  ? 'text-green-600 hover:text-green-700'
                                  : 'text-gray-400 hover:text-green-600'
                              }`}
                              title={isConfirmed(row.id) ? 'Bestätigung aufheben' : 'Bestätigen'}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => startEditing(row)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Bearbeiten"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteRow(row.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Edit Mode: Correction Reason Row */}
                  {isEditing(row.id) && (
                    <tr key={`${row.id}-edit`} className="bg-amber-50 border-b border-gray-200">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="flex flex-wrap items-start gap-4">
                          {/* Correction Reason Dropdown */}
                          <div className="flex-1 min-w-[250px]">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Grund für Korrektur <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <select
                                value={editData.correctionReason}
                                onChange={(e) => handleEditChange('correctionReason', e.target.value)}
                                className={`w-full px-3 py-2 text-sm border rounded-md appearance-none focus:outline-none focus:ring-1 bg-white ${
                                  validationError && !editData.correctionReason
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-gray-200 focus:ring-gray-900'
                                }`}
                              >
                                <option value="">Bitte auswählen...</option>
                                {CORRECTION_REASONS.map((reason) => (
                                  <option key={reason} value={reason}>
                                    {reason}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>

                          {/* Notes Field */}
                          <div className="flex-1 min-w-[250px]">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Notizen (optional)
                            </label>
                            <input
                              type="text"
                              value={editData.notes}
                              onChange={(e) => handleEditChange('notes', e.target.value)}
                              placeholder="Zusätzliche Bemerkungen..."
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                            />
                          </div>
                        </div>

                        {/* Validation Error */}
                        {validationError && (
                          <div className="mt-2 text-xs text-red-600">
                            {validationError}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Row */}
        <div className="mt-3 flex justify-between items-center">
          <div className="text-xs text-gray-500 flex gap-4">
            {confirmedRows.size > 0 && (
              <span className="text-green-600">
                {confirmedRows.size} von {tableData.length} bestätigt
              </span>
            )}
            {savedCorrections.length > 0 && (
              <span className="text-amber-600">
                {savedCorrections.length} Korrektur(en) vorgenommen
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Zeige <span className="font-medium text-gray-700">{tableData.length}</span> Positionen
          </div>
        </div>
      </div>
    </div>
  );
}
