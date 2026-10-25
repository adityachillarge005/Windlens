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
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-sky-400" />
              Forecast Revision Evolution for Delivery Interval
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any delivery interval in January 2026 to see all predictions leading up to delivery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-400">Target Interval (UTC):</label>
            <input
              type="text"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-500 w-52"
            />
            <button
              onClick={fetchHistory}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white transition-colors"
            >
              Inspect
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Quick Jump:</span>
          {presets.map((pr, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTargetTime(pr.value);
                if (onSelectInterval) onSelectInterval(pr.value);
              }}
              className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                targetTime === pr.value
                  ? 'bg-sky-950/60 border-sky-600 text-sky-300 font-medium'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Target Interval</span>
              <span className="font-mono text-base font-bold text-slate-100">{data.target_time}</span>
              <span className="text-xs text-slate-500 block mt-1">Delivery Time (UTC)</span>
            </div>

            <div className="rounded-xl border border-sky-800/40 bg-sky-950/20 p-4">
              <span className="text-xs text-sky-400 uppercase tracking-wider block mb-1">Decision-Time Forecast</span>
              <span className="font-mono text-xl font-bold text-sky-300">
                {selectedDecision ? `${selectedDecision.generation?.toLocaleString()} MW` : 'N/A'}
              </span>
              <span className="text-xs text-slate-400 block mt-1">
                Active at {data.cutoff_time?.substring(11, 16)} Cutoff (D-1)
              </span>
            </div>

            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
              <span className="text-xs text-emerald-400 uppercase tracking-wider block mb-1">Actual Outturn Generation</span>
              <span className="font-mono text-xl font-bold text-emerald-400">
                {actualGen !== null && actualGen !== undefined ? `${actualGen.toLocaleString()} MW` : 'Pending'}
              </span>
              <span className="text-xs text-slate-400 block mt-1">Metered Elexon FUELHH</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Revisions Recorded</span>
              <span className="font-mono text-xl font-bold text-slate-200">{data.total_publications}</span>
              <span className="text-xs text-slate-500 block mt-1">Total published updates</span>
            </div>
          </div>

          {/* Revision Trend Chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Forecast Evolution Leading Up to Delivery</h4>
                <p className="text-xs text-slate-400">
                  Observe how the predicted generation stepped or shifted across successive Elexon WINDFOR publications.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-sky-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                  Decision Selected Point
                </span>
                {actualGen && (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Actual Target Line
                  </span>
                )}
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} dy={8} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit=" MW" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                    }}
                    formatter={(val, name, item) => {
                      const note = item.payload.isDecision ? ' [ACTIVE AT DECISION CUTOFF]' : '';
                      return [`${Number(val).toLocaleString()} MW${note}`, 'Forecast'];
                    }}
                  />
                  {actualGen && (
                    <ReferenceLine
                      y={actualGen}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: `Actual: ${actualGen} MW`, fill: '#10b981', position: 'top', fontSize: 11 }}
                    />
                  )}
                  <Line
                    type="stepAfter"
                    dataKey="forecast"
                    name="Forecast Generation"
                    stroke="#0284c7"
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
                            fill="#38bdf8"
                            stroke="#ffffff"
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
                          fill={payload.isEligible ? '#0284c7' : '#64748b'}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revisions Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
            <h4 className="text-sm font-semibold text-slate-100 mb-1">Chronological Publication Log</h4>
            <p className="text-xs text-slate-400 mb-4">
              All forecasts ordered by publishTime. Post-cutoff updates are explicitly segregated to prevent look-ahead bias.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Publish Time (UTC)</th>
                    <th className="py-2.5 px-3">Lead Time</th>
                    <th className="py-2.5 px-3">Forecast (MW)</th>
                    <th className="py-2.5 px-3">Revision Delta</th>
                    <th className="py-2.5 px-3">Category &amp; Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {publications.map((p, idx) => (
                    <tr
                      key={idx}
                      className={
                        p.is_selected_decision_forecast
                          ? 'bg-sky-950/40 border-l-4 border-l-sky-500'
                          : !p.is_eligible_at_cutoff
                          ? 'opacity-60 hover:opacity-100 transition-opacity'
                          : 'hover:bg-slate-800/30 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-3 text-slate-300 font-medium">
                        {p.publishTime}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {p.lead_hours_before_delivery} hrs prior
                      </td>
                      <td className="py-2.5 px-3 text-slate-100 font-semibold">
                        {p.generation?.toLocaleString()} MW
                      </td>
                      <td
                        className={`py-2.5 px-3 ${
                          p.revision_delta_mw > 0
                            ? 'text-emerald-400'
                            : p.revision_delta_mw < 0
                            ? 'text-rose-400'
                            : 'text-slate-500'
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-sky-900/60 text-sky-300 border border-sky-700/60">
                            <CheckCircle2 className="w-3 h-3 text-sky-400" />
                            Active at Cutoff ({cutoffTime} D-1)
                          </span>
                        ) : p.is_eligible_at_cutoff ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-slate-800 text-slate-300">
                            Pre-Cutoff Revision
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-slate-900 text-slate-500 border border-slate-800">
                            Post-Cutoff / Intraday (Excluded from Day-Ahead)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {publications.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
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
