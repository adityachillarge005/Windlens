import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-slate-800 my-4 shadow-sm">
      <div className="flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-rose-900">Data Retrieval Notice</h4>
          <p className="text-xs text-rose-700 mt-1 leading-relaxed">
            {message || 'An error occurred while loading analytics.'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Query
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
