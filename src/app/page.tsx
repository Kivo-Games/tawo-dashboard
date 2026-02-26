'use client';

import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  TABLE_HEADER_KEYS,
  TABLE_LABELS,
  HEADER_TO_KEY,
} from '@/lib/table-columns';

const UPLOAD_API_URL = '/api/upload-gaeb';
const SUPPORTED_EXTENSIONS = ['.x81', '.x82', '.x83', '.d81', '.p81'];

/** Parse CSV string into { headers, rows }. Handles quoted fields. */
function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] }
  const parseRow = (line: string): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let cell = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"') {
            i++;
            if (line[i] === '"') { cell += '"'; i++; }
            else break;
          } else { cell += line[i]; i++; }
        }
        out.push(cell);
        if (line[i] === ',') i++;
      } else {
        const j = line.indexOf(',', i);
        if (j === -1) {
          out.push(line.slice(i).trim());
          break;
        }
        out.push(line.slice(i, j).trim());
        i = j + 1;
      }
    }
    return out;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

/** Normalize a raw row (from API/CSV) into our table row shape (TABLE_HEADER_KEYS + id). */
function normalizeRow(
  raw: Record<string, unknown> | null,
  headerToKeyMap?: Record<string, string>
): Record<string, string> {
  const o: Record<string, string> = {};
  const map = headerToKeyMap ?? HEADER_TO_KEY;
  TABLE_HEADER_KEYS.forEach((key) => {
    o[key] = String(raw?.[key] ?? '');
  });
  if (raw && typeof raw.id !== 'undefined') o['id'] = String(raw.id);
  else if (raw && typeof raw.Id !== 'undefined') o['id'] = String(raw.Id);
  else o['id'] = '';
  if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach((h) => {
      const key = map[h] ?? map[h.toLowerCase()];
      if (key && TABLE_HEADER_KEYS.includes(key))
        o[key] = String((raw as Record<string, unknown>)[h] ?? '');
    });
  }
  return o;
}

/** Normalize API response into table shape: { headers, rows, labels } using shared column config. */
function toTableData(data: unknown): { headers: string[]; rows: Record<string, string>[]; labels?: Record<string, string> } | null {
  if (data == null) return null;
  const headers = TABLE_HEADER_KEYS;
  const labels = TABLE_LABELS;

  if (Array.isArray(data)) {
    if (data.length === 0) return { headers, rows: [], labels };
    const rows = data.map((row) =>
      normalizeRow(typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : null)
    );
    return { headers, rows, labels };
  }
  if (typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message: string }).message === 'string') {
    const csv = (data as { message: string }).message;
    if (/[\n,"]/.test(csv)) {
      const { headers: csvHeaders, rows: csvRows } = parseCsv(csv);
      const rows = csvRows.map((r) => {
        const raw: Record<string, unknown> = {};
        csvHeaders.forEach((h, i) => {
          raw[h] = r[i] ?? '';
        });
        return normalizeRow(raw);
      });
      return { headers, rows, labels };
    }
  }
  if (typeof data === 'object' && data !== null && 'rows' in data && Array.isArray((data as { rows: unknown }).rows)) {
    const { rows: rawRows } = data as { rows: Record<string, unknown>[] };
    const rows = rawRows.map((r) => normalizeRow(r));
    return { headers, rows, labels };
  }
  // Nested shapes (e.g. n8n returns { body: { rows: [...] } } or { data: { rows: [...] } })
  const obj = data as Record<string, unknown>;
  if (typeof obj === 'object' && obj !== null) {
    let nestedRows: Record<string, unknown>[] | null = null;
    if (typeof obj.body === 'object' && obj.body !== null && Array.isArray((obj.body as Record<string, unknown>).rows)) {
      nestedRows = (obj.body as { rows: Record<string, unknown>[] }).rows;
    } else if (Array.isArray(obj.body)) {
      nestedRows = obj.body as Record<string, unknown>[];
    } else if (typeof obj.data === 'object' && obj.data !== null && Array.isArray((obj.data as Record<string, unknown>).rows)) {
      nestedRows = (obj.data as { rows: Record<string, unknown>[] }).rows;
    } else if (Array.isArray(obj.data)) {
      nestedRows = obj.data as Record<string, unknown>[];
    }
    if (nestedRows && nestedRows.length >= 0) {
      const rows = nestedRows.map((r) =>
        normalizeRow(typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : null)
      );
      return { headers, rows, labels };
    }
  }
  return null;
}

const REVIEW_STORAGE_KEY = 'tawo_review_data';

function hasExistingReviewData(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(REVIEW_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data?.tableData?.rows != null && Array.isArray(data.tableData.rows);
  } catch {
    return false;
  }
}

export default function CreateProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [margin, setMargin] = useState('15,0');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [tableData, setTableData] = useState<{ headers: string[]; rows: Record<string, string>[]; labels?: Record<string, string> } | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<null | 'reset' | { file: File }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidFile = (file: File): boolean => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(extension);
  };

  const uploadFile = async (file: File) => {
    if (!isValidFile(file)) {
      setUploadStatus('error');
      setUploadMessage(`Ungültiges Dateiformat. Unterstützte Formate: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      return;
    }

    setFileName(file.name);
    setUploadStatus('uploading');
    setUploadMessage('Datei wird hochgeladen...');

    try {
      const formData = new FormData();
      formData.append('data', file);

      const response = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json().catch(() => null);

      if (response.ok) {
        setUploadStatus('success');
        setUploadMessage(`Datei "${file.name}" erfolgreich hochgeladen!`);
        const parsed = toTableData(responseData);
        setTableData(parsed);
        if (parsed && (parsed.headers.length > 0 || parsed.rows.length > 0)) {
          try {
            sessionStorage.setItem(
              REVIEW_STORAGE_KEY,
              JSON.stringify({
                tableData: parsed,
                projectName,
                margin,
                fileName: file.name,
              })
            );
            router.push('/review');
          } catch {
            // sessionStorage full or unavailable, stay on page
          }
        }
      } else {
        const errorMsg =
          responseData && typeof responseData === 'object' && 'error' in responseData && typeof responseData.error === 'string'
            ? responseData.error
            : `Upload fehlgeschlagen mit Status ${response.status}`;
        throw new Error(errorMsg);
      }
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Upload fehlgeschlagen. Bitte erneut versuchen.');
      console.error('Upload error:', error);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (hasExistingReviewData()) {
        setConfirmOverwrite({ file: files[0] });
      } else {
        uploadFile(files[0]);
      }
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (hasExistingReviewData()) {
        setConfirmOverwrite({ file: files[0] });
      } else {
        uploadFile(files[0]);
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadMessage('');
    setFileName('');
    setTableData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const requestResetUpload = () => {
    if (hasExistingReviewData()) {
      setConfirmOverwrite('reset');
    } else {
      try {
        sessionStorage.removeItem(REVIEW_STORAGE_KEY);
      } catch {}
      resetUpload();
    }
  };

  const handleConfirmOverwrite = () => {
    if (confirmOverwrite === 'reset') {
      try {
        sessionStorage.removeItem(REVIEW_STORAGE_KEY);
      } catch {}
      resetUpload();
    } else if (confirmOverwrite && typeof confirmOverwrite === 'object' && confirmOverwrite.file) {
      uploadFile(confirmOverwrite.file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setConfirmOverwrite(null);
  };

  const handleCancelOverwrite = () => {
    setConfirmOverwrite(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-6">
      {/* Overwrite confirmation – only when review/matching data exists */}
      {confirmOverwrite !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={handleCancelOverwrite}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-overwrite-title"
        >
          <div
            className="bg-white rounded-lg shadow-lg border border-gray-200 p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-overwrite-title" className="text-sm font-semibold text-gray-900 mb-2">
              Andere Datei hochladen?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Es sind bereits Daten in Prüfung oder Matching. Ein neuer Upload überschreibt diese und bricht den aktuellen Vorgang ab.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelOverwrite}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
              >
                Ja, überschreiben
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">
          Neues Projekt erstellen
        </h1>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <form className="space-y-6">
            {/* Project Name */}
            <div>
              <label
                htmlFor="projectName"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Projektname *
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Projektname eingeben"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
              />
            </div>

            {/* Default Margin */}
            <div>
              <label
                htmlFor="margin"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Standard-Marge (%)
              </label>
              <input
                type="text"
                id="margin"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Standardmarge für Kalkulationen
              </p>
            </div>

            {/* GAEB File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                GAEB-Datei hochladen
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".x81,.x82,.x83,.d81,.p81"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={uploadStatus === 'idle' ? handleBrowseClick : undefined}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-gray-900 bg-gray-50'
                    : uploadStatus === 'success'
                    ? 'border-green-300 bg-green-50'
                    : uploadStatus === 'error'
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {uploadStatus === 'uploading' ? (
                  <>
                    <Loader2 className="mx-auto h-10 w-10 text-gray-400 mb-3 animate-spin" />
                    <p className="text-sm text-gray-600 mb-1">{uploadMessage}</p>
                    <p className="text-xs text-gray-400">{fileName}</p>
                  </>
                ) : uploadStatus === 'success' ? (
                  <>
                    <CheckCircle className="mx-auto h-10 w-10 text-green-500 mb-3" />
                    <p className="text-sm text-green-600 mb-1">{uploadMessage}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        requestResetUpload();
                      }}
                      className="mt-3 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Weitere Datei hochladen
                    </button>
                  </>
                ) : uploadStatus === 'error' ? (
                  <>
                    <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
                    <p className="text-sm text-red-600 mb-1">{uploadMessage}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        requestResetUpload();
                      }}
                      className="mt-3 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Erneut versuchen
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className={`mx-auto h-10 w-10 mb-3 ${isDragging ? 'text-gray-900' : 'text-gray-400'}`} />
                    <p className="text-sm text-gray-600 mb-1">
                      {isDragging ? 'Datei hier ablegen' : 'GAEB-Datei hierher ziehen oder klicken zum Durchsuchen'}
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      Unterstützte Formate: .x81, .x82, .x83, .d81, .p81
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBrowseClick();
                      }}
                      className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Dateien durchsuchen
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
