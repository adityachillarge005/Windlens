import React from 'react';
import { Info } from 'lucide-react';

export default function KPICard({
  title,
  value,
  unit,
  subtitle,
  comparison,
  tooltip,
  variant = 'neutral'
}) {
  const variantStyles = {
    neutral: 'border-slate-800 bg-slate-900/80',
    primary: 'border-sky-800/40 bg-sky-950/20',
    success: 'border-emerald-800/40 bg-emerald-950/20',
    warning: 'border-amber-800/40 bg-amber-950/20',
    danger: 'border-rose-800/40 bg-rose-950/20',
  };

  const textStyles = {
    neutral: 'text-slate-100',
    primary: 'text-sky-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  };

  return (
    <div className={`rounded-xl border p-5 backdrop-blur-sm transition-all hover:border-slate-700 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-2">
        <span className="uppercase tracking-wider">{title}</span>
        {tooltip && (
          <div className="group relative cursor-help">
            <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors" />
            <div className="pointer-events-none absolute right-0 top-6 z-50 hidden w-64 rounded-lg bg-slate-800 p-2.5 text-xs text-slate-300 shadow-xl border border-slate-700 group-hover:block">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${textStyles[variant]}`}>
          {value !== null && value !== undefined ? (typeof value === 'number' ? value.toLocaleString() : value) : '—'}
        </span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>

      {(subtitle || comparison) && (
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          {subtitle && <span>{subtitle}</span>}
          {comparison && <span className="text-sky-300 font-medium">{comparison}</span>}
        </div>
      )}
    </div>
  );
}
