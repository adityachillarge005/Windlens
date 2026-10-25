import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 p-6 text-slate-200 my-4">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-rose-900/30 text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-semibold text-rose-300">Data Retrieval Notice</h4>
          <p className="text-sm text-slate-300 mt-1">{message || 'An error occurred while loading analytics.'}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-xs font-medium text-rose-200 transition-colors"
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
