import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading energy analytics data...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-slate-500">
      <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{message}</p>
      <span className="text-xs text-slate-400 mt-1">Querying Elexon BMRS analytics pipeline</span>
    </div>
  );
}
