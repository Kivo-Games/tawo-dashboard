'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';

export default function CreateProjectPage() {
  const [projectName, setProjectName] = useState('');
  const [margin, setMargin] = useState('15,0');
  const [context, setContext] = useState('');

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">
          Create New Project
        </h1>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <form className="space-y-6">
            {/* Project Name */}
            <div>
              <label
                htmlFor="projectName"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Project Name *
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
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
                Default Margin (%)
              </label>
              <input
                type="text"
                id="margin"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Standard margin applied in calculations
              </p>
            </div>

            {/* GAEB File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                GAEB File Upload
              </label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors cursor-pointer">
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 mb-1">
                  Drag and drop your GAEB file here, or click to browse
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  Supported formats: .x81, .x82, .x83, .d81, .p81
                </p>
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                >
                  Browse Files
                </button>
              </div>
            </div>

            {/* Additional Context & Instructions */}
            <div>
              <label
                htmlFor="context"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Additional Context & Instructions
              </label>
              <textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
                placeholder="Add any specific instructions, notes, or context for this project..."
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors resize-none"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Optional notes or instructions for processing this project
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                Continue to Review
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
