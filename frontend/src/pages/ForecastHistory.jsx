import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { History, ShieldCheck, AlertCircle, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ForecastHistory({
  selectedInterval,
  onSelectInterval,
  cutoffTime,
  darkMode,
}) {
  const [targetTime, setTargetTime] = useState(selectedInterval || '2026-01-05T12:00:00Z');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Suggested preset intervals to easily inspect
  const presets = [
    { label: 'Jan 5 12:00 (Standard Delivery)', value: '2026-01-05T12:00:00Z' },
    { label: 'Jan 12 01:00 (High Over-forecast)', value: '2026-01-12T01:00:00Z' },
    { label: 'Jan 15 18:00 (Evening Peak)', value: '2026-01-15T18:00:00Z' },
    { label: 'Jan 20 04:00 (Off-Peak Night)', value: '2026-01-20T04:00:00Z' },
    { label: 'Jan 28 15:00 (High Wind Event)', value: '2026-01-28T15:00:00Z' },
  ];

  useEffect(() => {
    if (selectedInterval) {
      setTargetTime(selectedInterval);
    }
  }, [selectedInterval]);

  const fetchHistory = async () => {
    if (!targetTime) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getForecastHistory(targetTime, cutoffTime);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load forecast history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [targetTime, cutoffTime]);

  const publications = data?.publications || [];
  const selectedDecision = data?.selected_decision_forecast;
  const actualGen = data?.actual_generation;

  // Chart data
  const chartData = publications.map((p) => ({
    time: p.publishTime.substring(5, 16).replace('T', ' '),
    rawTime: p.publishTime,
    forecast: p.generation,
    leadHours: p.lead_hours_before_delivery,
    isDecision: p.is_selected_decision_forecast,
    isEligible: p.is_eligible_at_cutoff,
  }));

  return (
    <div className="space-y-6">
      {/* Target Delivery Interval Selector Bar */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Forecast Revision Evolution for Delivery Interval
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select any delivery interval in January 2026 to inspect all predictions leading up to outturn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Target Interval (UTC):</label>
            <input
              type="text"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
              className="px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-950/70 backdrop-blur-xs border border-slate-200/80 dark:border-white/10 text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 w-56 transition-colors"
            />
            <button
              onClick={fetchHistory}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs hover:shadow-md transition-all"
            >
              Inspect
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/60 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 dark:text-slate-500 font-medium mr-1">Quick Jump:</span>
          {presets.map((pr, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTargetTime(pr.value);
                if (onSelectInterval) onSelectInterval(pr.value);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border backdrop-blur-xs transition-colors ${
                targetTime === pr.value
                  ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-2xs font-semibold'
                  : 'bg-white/70 dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner message="Retrieving forecast revision publications..." />}
      {error && <ErrorMessage message={error} onRetry={fetchHistory} />}

      {!loading && !error && data && (
        <>
          {/* Interval Summary Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Target Interval
              </span>
              <span className="font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-white block truncate">
                {data.target_time}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 block mt-1">Delivery Time (UTC)</span>
            </div>

            <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider block mb-1">
                Decision Forecast
              </span>
              <span className="font-mono text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300 block">
                {selectedDecision ? `${selectedDecision.generation?.toLocaleString()} MW` : 'N/A'}
              </span>
              <span className="text-xs text-blue-600/80 dark:text-blue-400/80 block mt-1">
                Active at {data.cutoff_time?.substring(11, 16)} Cutoff (D-1)
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block mb-1">
                Actual Outturn
              </span>
              <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300 block">
                {actualGen !== null && actualGen !== undefined ? `${actualGen.toLocaleString()} MW` : 'Pending'}
              </span>
              <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 block mt-1">Metered Elexon FUELHH</span>
            </div>

            <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Revisions Recorded
              </span>
              <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white block">
                {data.total_publications}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 block mt-1">Total published updates</span>
            </div>
          </div>

          {/* Revision Trend Chart */}
          <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Forecast Evolution Leading Up to Delivery</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Observe how predicted generation evolved across successive Elexon WINDFOR publications.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  Decision Selected Point
                </span>
                {actualGen && (
                  <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Actual Target Line
                  </span>
                )}
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 15, right: 15, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1E293B' : '#F1F5F9'} vertical={false} />
                  <XAxis dataKey="time" stroke={darkMode ? '#64748B' : '#94A3B8'} fontSize={10} tickLine={false} axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }} dy={8} />
                  <YAxis stroke={darkMode ? '#64748B' : '#94A3B8'} fontSize={10} tickLine={false} axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }} unit=" MW" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
                      borderColor: darkMode ? '#334155' : '#E2E8F0',
                      color: darkMode ? '#F1F5F9' : '#0F172A',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '0.75rem',
                    }}
                    formatter={(val, name, item) => {
                      const note = item.payload.isDecision ? ' [ACTIVE AT DECISION CUTOFF]' : '';
                      return [
                        <span style={{ fontWeight: 600, color: item.payload.isDecision ? '#3B82F6' : (darkMode ? '#F1F5F9' : '#0F172A') }}>
                          {Number(val).toLocaleString()} MW{note}
                        </span>,
                        'Forecast',
                      ];
                    }}
                  />
                  {actualGen && (
                    <ReferenceLine
                      y={actualGen}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                      label={{ value: `Actual: ${actualGen.toLocaleString()} MW`, fill: '#10B981', position: 'top', fontSize: 11, fontWeight: 600 }}
                    />
                  )}
                  <Line
                    type="stepAfter"
                    dataKey="forecast"
                    name="Forecast Generation"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload.isDecision) {
                        return (
                          <circle
                            key={`dot-${payload.rawTime}`}
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill="#2563EB"
                            stroke={darkMode ? '#0F172A' : '#FFFFFF'}
                            strokeWidth={2}
                          />
                        );
                      }
                      return (
                        <circle
                          key={`dot-${payload.rawTime}`}
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill={payload.isEligible ? '#60A5FA' : (darkMode ? '#475569' : '#CBD5E1')}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revisions Table */}
          <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Chronological Publication Log</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              All forecasts ordered by publishTime. Post-cutoff updates are explicitly segregated to prevent look-ahead bias.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] bg-slate-50/50 dark:bg-slate-800/40 backdrop-blur-xs">
                    <th className="py-2.5 px-3 rounded-l-lg font-semibold">Publish Time (UTC)</th>
                    <th className="py-2.5 px-3 font-semibold">Lead Time</th>
                    <th className="py-2.5 px-3 font-semibold">Forecast (MW)</th>
                    <th className="py-2.5 px-3 font-semibold">Revision Delta</th>
                    <th className="py-2.5 px-3 rounded-r-lg font-semibold">Category &amp; Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {publications.map((p, idx) => (
                    <tr
                      key={idx}
                      className={
                        p.is_selected_decision_forecast
                          ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-4 border-l-blue-600'
                          : !p.is_eligible_at_cutoff
                          ? 'opacity-60 hover:opacity-100 transition-opacity'
                          : 'hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-3 text-slate-900 dark:text-slate-200 font-medium">
                        {p.publishTime}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                        {p.lead_hours_before_delivery} hrs prior
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100 font-bold">
                        {p.generation?.toLocaleString()} MW
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold ${
                          p.revision_delta_mw > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : p.revision_delta_mw < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {p.revision_delta_mw > 0
                          ? `+${p.revision_delta_mw} MW`
                          : p.revision_delta_mw < 0
                          ? `${p.revision_delta_mw} MW`
                          : '0 MW'}
                      </td>
                      <td className="py-2.5 px-3">
                        {p.is_selected_decision_forecast ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            Active at Cutoff ({cutoffTime} D-1)
                          </span>
                        ) : p.is_eligible_at_cutoff ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Pre-Cutoff Revision
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800">
                            Post-Cutoff / Intraday (Excluded from Day-Ahead)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {publications.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">
                        No forecast records found for interval {data.target_time}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
