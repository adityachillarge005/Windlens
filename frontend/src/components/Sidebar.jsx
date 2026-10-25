import React from 'react';
import {
  Wind,
  LineChart,
  History,
  ShieldCheck,
  CheckCircle2,
  X,
  Database,
  Moon,
  Sun,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  onSelectTab,
  healthStatus,
  isOpen,
  onClose,
  darkMode,
  onToggleTheme,
}) {
  const navItems = [
    {
      id: 'monitor',
      label: 'Forecast Monitor',
      icon: Wind,
      badge: null,
    },
    {
      id: 'accuracy',
      label: 'Accuracy Reports',
      icon: LineChart,
      badge: '744 hrs',
    },
    {
      id: 'history',
      label: 'Forecast Revisions',
      icon: History,
      badge: null,
    },
    {
      id: 'methodology',
      label: 'Methodology & Audit',
      icon: ShieldCheck,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-white/60 dark:border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Upper: Logo & Nav */}
        <div className="p-5">
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                <Wind className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">WindLens</span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/50">
                    UK
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Day-Ahead Analytics</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="mt-6 space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 block mb-2">
              Analytics
            </span>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onClose) onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-blue-600 dark:text-blue-400 stroke-[2.2]' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lower: Support, System Health & Theme Toggle */}
        <div className="p-5 border-t border-slate-200/50 dark:border-slate-800 bg-white/40 dark:bg-slate-950/40 space-y-3">
          {/* Theme Quick Toggle */}
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md text-xs font-medium text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              {darkMode ? (
                <Moon className="w-4 h-4 text-blue-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>Theme: {darkMode ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Toggle
            </span>
          </button>

          {/* System Health Card */}
          <div className="rounded-xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                Data Source
              </span>
              <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Elexon BMRS
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Evaluation Period</span>
              <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                Jan 2026 (744h)
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    healthStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {healthStatus?.connected ? 'API Connected' : 'Disconnected'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">v1.1.0</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
