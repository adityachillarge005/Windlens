import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import Dashboard from './pages/Dashboard';
import Accuracy from './pages/Accuracy';
import ForecastHistory from './pages/ForecastHistory';
import Methodology from './pages/Methodology';
import {
  Wind,
  LineChart as LineChartIcon,
  History,
  ShieldCheck,
  Clock,
  Layers,
  Calendar,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('monitor');
  const [cutoffTime, setCutoffTime] = useState('11:00');
  const [resolution, setResolution] = useState('exact_hourly');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');
  const [selectedInterval, setSelectedInterval] = useState('2026-01-05T12:00:00Z');
  const [healthStatus, setHealthStatus] = useState({ connected: false, loading: true });

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-lg shadow-sky-600/20">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-white">WindLens</h1>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-400 border border-sky-800/60 uppercase">
                    UK Day-Ahead
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Wind Generation Forecast Uncertainty &amp; Procurement Monitor
                </p>
              </div>
            </div>

            {/* Global Controls & Status */}
            <div className="flex items-center gap-3">
              {/* Decision Cutoff Selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-slate-400 hidden md:inline">Cutoff:</span>
                <select
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
                  title="Day-ahead auction gate closure cutoff (D-1 Europe/London)"
                >
                  <option value="11:00" className="bg-slate-900">11:00 D-1 (EPEX SPOT Default)</option>
                  <option value="12:00" className="bg-slate-900">12:00 D-1 (Nord Pool Gate)</option>
                  <option value="14:00" className="bg-slate-900">14:00 D-1 (Afternoon)</option>
                  <option value="17:00" className="bg-slate-900">17:00 D-1 (Evening Gate)</option>
                </select>
              </div>

              {/* Resolution Toggle */}
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="exact_hourly" className="bg-slate-900">Exact Hourly (744 periods)</option>
                  <option value="half_hourly_mapped" className="bg-slate-900">Half-Hour Mapped (1,488)</option>
                </select>
              </div>

              {/* Backend Status Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    healthStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-slate-400 hidden sm:inline">
                  {healthStatus.connected ? 'API Live (Jan 2026)' : 'API Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 border-t border-slate-800/80 -mb-px">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'monitor'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Wind className="w-4 h-4" />
              Forecast Monitor
            </button>

            <button
              onClick={() => setActiveTab('accuracy')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'accuracy'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <LineChartIcon className="w-4 h-4" />
              Forecast Accuracy
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <History className="w-4 h-4" />
              Forecast Revisions
            </button>

            <button
              onClick={() => setActiveTab('methodology')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'methodology'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Data Quality &amp; Methodology
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Date Filter Bar for Monitor & Accuracy tabs */}
        {(activeTab === 'monitor' || activeTab === 'accuracy') && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 rounded-xl border border-slate-800 bg-slate-900/50 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span className="font-medium text-slate-300">Analysis Date Range:</span>
              <span className="text-slate-400 font-mono">
                {startDate} to {endDate}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => { setStartDate('2026-01-01'); setEndDate('2026-01-31'); }}
                className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                  startDate === '2026-01-01' && endDate === '2026-01-31'
                    ? 'bg-sky-950 border-sky-600 text-sky-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Full January 2026
              </button>
              <button
                onClick={() => { setStartDate('2026-01-01'); setEndDate('2026-01-07'); }}
                className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                  startDate === '2026-01-01' && endDate === '2026-01-07'
                    ? 'bg-sky-950 border-sky-600 text-sky-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Week 1 (Jan 1-7)
              </button>
              <button
                onClick={() => { setStartDate('2026-01-08'); setEndDate('2026-01-14'); }}
                className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                  startDate === '2026-01-08' && endDate === '2026-01-14'
                    ? 'bg-sky-950 border-sky-600 text-sky-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Week 2 (Jan 8-14)
              </button>
              <button
                onClick={() => { setStartDate('2026-01-15'); setEndDate('2026-01-21'); }}
                className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                  startDate === '2026-01-15' && endDate === '2026-01-21'
                    ? 'bg-sky-950 border-sky-600 text-sky-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Week 3 (Jan 15-21)
              </button>
              <button
                onClick={() => { setStartDate('2026-01-22'); setEndDate('2026-01-31'); }}
                className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                  startDate === '2026-01-22' && endDate === '2026-01-31'
                    ? 'bg-sky-950 border-sky-600 text-sky-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Week 4 (Jan 22-31)
              </button>
            </div>
          </div>
        )}

        {/* Tab Pages */}
        {activeTab === 'monitor' && (
          <Dashboard
            cutoffTime={cutoffTime}
            resolution={resolution}
            startDate={startDate}
            endDate={endDate}
            onSelectInterval={handleSelectInterval}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'accuracy' && (
          <Accuracy
            cutoffTime={cutoffTime}
            resolution={resolution}
            startDate={startDate}
            endDate={endDate}
            onSelectInterval={handleSelectInterval}
          />
        )}

        {activeTab === 'history' && (
          <ForecastHistory
            selectedInterval={selectedInterval}
            onSelectInterval={setSelectedInterval}
            cutoffTime={cutoffTime}
          />
        )}

        {activeTab === 'methodology' && <Methodology />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WindLens v1.0.0 — Production-grade UK Wind Forecast Analytics for Wholesale Energy Trading</span>
          <span>Data Source: Elexon BMRS Open API v1 (FUELHH &amp; WINDFOR)</span>
        </div>
      </footer>
    </div>
  );
}
