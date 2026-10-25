import React from 'react';
import { Info } from 'lucide-react';

export default function KPICard({
  title,
  value,
  unit,
  subtitle,
  comparison,
  tooltip,
  variant = 'neutral',
  sparkline = false,
}) {
  const variantBadgeStyles = {
    neutral: 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300',
    primary: 'bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
    success: 'bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-50/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    danger: 'bg-rose-50/80 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
  };

  const textValueStyles = {
    neutral: 'text-slate-900 dark:text-slate-100',
    primary: 'text-blue-600 dark:text-blue-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] transition-all duration-200 hover:bg-white/85 dark:hover:bg-slate-900/75 hover:border-slate-300/80 dark:hover:border-white/20 hover:shadow-[0_12px_36px_rgb(0,0,0,0.08)] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5">
          <span className="font-medium tracking-wide">{title}</span>
          {tooltip && (
            <div className="group relative cursor-help">
              <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" />
              <div className="pointer-events-none absolute right-0 top-6 z-50 hidden w-64 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-700/80 p-3 text-xs leading-relaxed text-slate-200 shadow-2xl group-hover:block">
                {tooltip}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1">
          <span className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${textValueStyles[variant] || 'text-slate-900 dark:text-slate-100'}`}>
            {value !== null && value !== undefined
              ? (typeof value === 'number' ? value.toLocaleString() : value)
              : '—'}
          </span>
          {unit && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">{unit}</span>}
        </div>
      </div>

      {(subtitle || comparison) && (
        <div className="mt-3 pt-2.5 border-t border-slate-100/80 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {comparison && (
            <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${variantBadgeStyles[variant] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
              {comparison}
            </span>
          )}
        </div>
      )}

      {/* Decorative waveform curve */}
      {sparkline && (
        <div className="mt-2 h-7 w-full overflow-hidden opacity-80 dark:opacity-60">
          <svg viewBox="0 0 100 24" className="w-full h-full stroke-blue-500 dark:stroke-blue-400 fill-blue-50/50 dark:fill-blue-950/20" preserveAspectRatio="none">
            <path
              d="M0 16 Q 15 6, 30 14 T 60 10 T 85 18 T 100 8 L 100 24 L 0 24 Z"
              strokeWidth="0"
            />
            <path
              d="M0 16 Q 15 6, 30 14 T 60 10 T 85 18 T 100 8"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
