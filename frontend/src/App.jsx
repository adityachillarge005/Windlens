import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Accuracy from './pages/Accuracy';
import ForecastHistory from './pages/ForecastHistory';
import Methodology from './pages/Methodology';
import {
  Menu,
  Download,
  Calendar,
  Clock,
  Layers,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('monitor');
  const [cutoffTime, setCutoffTime] = useState('11:00');
  const [resolution, setResolution] = useState('exact_hourly');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');
  const [timeframePreset, setTimeframePreset] = useState('all');
  const [selectedInterval, setSelectedInterval] = useState('2026-01-05T12:00:00Z');
  const [healthStatus, setHealthStatus] = useState({ connected: false, loading: true });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Default to light mode (matching the reference redesign), persist in localStorage
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('windlens_theme');
      if (saved) return saved === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('windlens_theme', 'dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('windlens_theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  // Check health on mount
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const res = await api.getHealth();
        setHealthStatus({ connected: res.status === 'healthy', data: res, loading: false });
      } catch (err) {
        setHealthStatus({ connected: false, error: err.message, loading: false });
      }
    };
    checkBackendHealth();
  }, []);

  const handleSelectInterval = (isoTime) => {
    setSelectedInterval(isoTime);
    setActiveTab('history');
  };

  const handleTimeframeChange = (preset) => {
    setTimeframePreset(preset);
    if (preset === 'all') {
      setStartDate('2026-01-01');
      setEndDate('2026-01-31');
    } else if (preset === 'w1') {
      setStartDate('2026-01-01');
      setEndDate('2026-01-07');
    } else if (preset === 'w2') {
      setStartDate('2026-01-08');
      setEndDate('2026-01-14');
    } else if (preset === 'w3') {
      setStartDate('2026-01-15');
      setEndDate('2026-01-21');
    } else if (preset === 'w4') {
      setStartDate('2026-01-22');
      setEndDate('2026-01-31');
    }
  };

  // CSV Export feature matching reference Download action
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const res = await api.getAccuracySeries({
        start_date: startDate,
        end_date: endDate,
        cutoff_time: cutoffTime,
        resolution: resolution,
      });

      const series = res?.matched_series || [];
      if (!series.length) {
        alert('No data available to export.');
        return;
      }

      const headers = ['Delivery Interval (UTC)', 'Actual (MW)', 'Decision Forecast (MW)', 'Forecast Error (MW)', 'Abs Error (MW)', 'Cutoff Timestamp'];
      const csvRows = [headers.join(',')];

      series.forEach((row) => {
        csvRows.push([
          `"${row.startTime}"`,
          row.actual !== null ? row.actual : '',
          row.decision_forecast !== null ? row.decision_forecast : '',
          row.error !== null ? row.error : '',
          row.abs_error !== null ? row.abs_error : '',
          `"${row.cutoff_timestamp || ''}"`,
        ].join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `windlens_${startDate}_to_${endDate}_cutoff_${cutoffTime.replace(':', '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'monitor':
        return 'Forecast Monitor';
      case 'accuracy':
        return 'Accuracy Reports';
      case 'history':
        return 'Forecast Revisions';
      case 'methodology':
        return 'Methodology & Data Audit';
      default:
        return 'WindLens';
    }
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex font-sans antialiased relative overflow-x-hidden transition-colors duration-200`}>
      {/* Ambient background blur orbs to power glassmorphism */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/15 dark:bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-[30rem] h-[30rem] bg-cyan-400/15 dark:bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-400/10 dark:bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        healthStatus={healthStatus}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 z-10">
        {/* Main Content Wrapper */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header Row: Title & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {getPageTitle()}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Great Britain Wind Generation Forecast &amp; Outturn Analytics (January 2026)
                </p>
              </div>
            </div>

            {/* Top Right Actions: Theme Toggle & Download Button */}
            <div className="flex items-center gap-2.5">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs hover:shadow-md transition-all"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>

              {/* Download CSV Button */}
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-white/90 dark:hover:bg-slate-800/80 hover:shadow-md transition-all disabled:opacity-50"
                title="Download verified interval data as CSV"
              >
                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>{isExporting ? 'Exporting...' : 'Download'}</span>
              </button>
            </div>
          </div>

          {/* Filter Row: Glassmorphic rounded pill controls */}
          {(activeTab === 'monitor' || activeTab === 'accuracy' || activeTab === 'history') && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Timeframe Dropdown Pill */}
              <div className="relative inline-flex items-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/80 dark:border-white/10 rounded-2xl px-3.5 py-1.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">Timeframe:</span>
                <select
                  value={timeframePreset}
                  onChange={(e) => handleTimeframeChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 pr-5 focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Full Month (Jan 1 - 31)</option>
                  <option value="w1" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Week 1 (Jan 1 - 7)</option>
                  <option value="w2" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Week 2 (Jan 8 - 14)</option>
                  <option value="w3" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Week 3 (Jan 15 - 21)</option>
                  <option value="w4" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Week 4 (Jan 22 - 31)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 pointer-events-none" />
              </div>

              {/* Cutoff Dropdown Pill */}
              <div className="relative inline-flex items-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/80 dark:border-white/10 rounded-2xl px-3.5 py-1.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">Cutoff:</span>
                <select
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 pr-5 focus:outline-none cursor-pointer appearance-none"
                  title="Configurable day-ahead wholesale procurement decision cutoff (D-1 Europe/London)"
                >
                  <option value="11:00" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">11:00 D-1 (Default)</option>
                  <option value="12:00" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">12:00 D-1</option>
                  <option value="14:00" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">14:00 D-1</option>
                  <option value="17:00" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">17:00 D-1</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 pointer-events-none" />
              </div>

              {/* Resolution Dropdown Pill */}
              <div className="relative inline-flex items-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/80 dark:border-white/10 rounded-2xl px-3.5 py-1.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">Resolution:</span>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 pr-5 focus:outline-none cursor-pointer appearance-none"
                  title="Hourly Averaged (744 periods) vs Half-Hourly Settlement (1,488 periods)"
                >
                  <option value="exact_hourly" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Hourly Averaged (744 periods)</option>
                  <option value="half_hourly_mapped" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Half-Hour Settlement (1,488)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 pointer-events-none" />
              </div>

              {/* Active Filter Scope Indicator */}
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline ml-auto">
                Scope: {startDate} to {endDate}
              </span>
            </div>
          )}

          {/* Active Tab Page Content */}
          <div className="pt-2">
            {activeTab === 'monitor' && (
              <Dashboard
                cutoffTime={cutoffTime}
                resolution={resolution}
                startDate={startDate}
                endDate={endDate}
                onSelectInterval={handleSelectInterval}
                onNavigateTab={setActiveTab}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'accuracy' && (
              <Accuracy
                cutoffTime={cutoffTime}
                resolution={resolution}
                startDate={startDate}
                endDate={endDate}
                onSelectInterval={handleSelectInterval}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'history' && (
              <ForecastHistory
                selectedInterval={selectedInterval}
                onSelectInterval={setSelectedInterval}
                cutoffTime={cutoffTime}
                darkMode={darkMode}
              />
            )}

            {activeTab === 'methodology' && <Methodology darkMode={darkMode} />}
          </div>
        </main>
      </div>
    </div>
  );
}
