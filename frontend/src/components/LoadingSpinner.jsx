import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading energy analytics data...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-400">
      <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-3" />
      <p className="text-sm font-medium">{message}</p>
      <span className="text-xs text-slate-500 mt-1">Querying Elexon BMRS analytics pipeline</span>
    </div>
  );
}
