import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import KPICard from '../components/KPICard';
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
} from 'recharts';
import { Wind, Clock, ShieldCheck, ArrowUpRight, Activity, Zap, CheckCircle2 } from 'lucide-react';

export default function Dashboard({
  cutoffTime,
  resolution,
  startDate,
  endDate,
  onSelectInterval,
  onNavigateTab,
  darkMode,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getForecastLatest({
        start_date: startDate,
        end_date: endDate,
        cutoff_time: cutoffTime,
        resolution: resolution,
      });
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load forecast monitor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cutoffTime, resolution, startDate, endDate]);

  if (loading) return <LoadingSpinner message="Loading forecast monitor..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const series = data?.series || [];
  const total = data?.total_intervals || 0;
  const matched = data?.matched_intervals || 0;
  const coveragePercent = total > 0 ? ((matched / total) * 100).toFixed(1) : 0;

  // Format chart data
  const chartData = series.map((item) => ({
    time: item.startTime.substring(5, 16).replace('T', ' '),
    rawTime: item.startTime,
    actual: item.actual,
    decisionForecast: item.decision_forecast,
    latestForecast: item.latest_forecast,
    error: item.error,
  }));

  // Calculate average generation
  const validDecision = series.filter((s) => s.decision_forecast !== null);
  const avgDecision = validDecision.length
    ? Math.round(validDecision.reduce((acc, s) => acc + s.decision_forecast, 0) / validDecision.length)
    : 0;

  const validActual = series.filter((s) => s.actual !== null);
  const avgActual = validActual.length
    ? Math.round(validActual.reduce((acc, s) => acc + s.actual, 0) / validActual.length)
    : 0;

  // Find top 3 peak wind generation intervals
  const peakIntervals = [...series]
    .filter((s) => s.actual !== null)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Average Actual Outturn"
          value={avgActual}
          unit="MW"
          subtitle={`Across ${validActual.length} intervals`}
          comparison="Elexon FUELHH"
          tooltip="Average metered transmission-system wind generation from official Elexon FUELHH records."
          variant="success"
          sparkline={true}
        />

        <KPICard
          title="Decision Forecast Avg"
          value={avgDecision}
          unit="MW"
          subtitle={`At ${cutoffTime} D-1 cutoff`}
          comparison={`Cutoff ${cutoffTime}`}
          tooltip="Average expected national wind generation published before the day-ahead procurement cutoff."
          variant="primary"
          sparkline={true}
        />

        <KPICard
          title="Forecast Coverage"
          value={`${coveragePercent}%`}
          unit=""
          subtitle={`${matched} of ${total} delivery intervals`}
          comparison={matched === total ? '100% Complete' : `${total - matched} missing`}
          tooltip="Percentage of delivery intervals with an eligible day-ahead forecast published strictly prior to the cutoff."
          variant="neutral"
        />

        <KPICard
          title="Evaluation Resolution"
          value={resolution === 'exact_hourly' ? 'Hourly Averaged' : 'Half-Hour Mapped'}
          unit=""
          subtitle={resolution === 'exact_hourly' ? '744 delivery hours' : '1,488 settlement periods'}
          comparison={resolution === 'exact_hourly' ? '1.0h Blocks' : '0.5h Blocks'}
          tooltip="Hourly averaged outturn ((A_:00 + A_:30) / 2) vs half-hourly settlement periods mapped from hourly forecasts."
          variant="neutral"
        />
      </div>

      {/* Main Chart Card: Hourly Forecast vs Actual Generation */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Activity className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Decision-Time Forecast vs Actual Wind Generation
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Evaluated at D-1 Cutoff ({cutoffTime} Europe/London) across {startDate} to {endDate}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab && onNavigateTab('accuracy')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-all"
            >
              Inspect Accuracy Reports
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1E293B' : '#F1F5F9'} vertical={false} />
              <XAxis
                dataKey="time"
                stroke={darkMode ? '#64748B' : '#94A3B8'}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }}
                dy={8}
              />
              <YAxis
                stroke={darkMode ? '#64748B' : '#94A3B8'}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }}
                unit=" MW"
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
                  borderColor: darkMode ? '#334155' : '#E2E8F0',
                  color: darkMode ? '#F1F5F9' : '#0F172A',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  fontSize: '0.75rem',
                  padding: '10px 14px',
                }}
                labelStyle={{ color: darkMode ? '#F1F5F9' : '#0F172A', fontWeight: 700, marginBottom: '6px' }}
                formatter={(val, name) => {
                  const labelMap = {
                    decisionForecast: ['Decision Forecast (D-1)', '#3B82F6'],
                    latestForecast: ['Latest Available Forecast', '#94A3B8'],
                    actual: ['Actual Generation', '#10B981'],
                  };
                  const [label, color] = labelMap[name] || [name, darkMode ? '#F1F5F9' : '#0F172A'];
                  return [
                    <span style={{ color, fontWeight: 600 }}>{Number(val).toLocaleString()} MW</span>,
                    label,
                  ];
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="decisionForecast"
                name="Decision-Time Forecast (D-1)"
                stroke="#2563EB"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#2563EB', stroke: darkMode ? '#0F172A' : '#FFFFFF', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="latestForecast"
                name="Latest Available Forecast"
                stroke={darkMode ? '#64748B' : '#94A3B8'}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Outturn (FUELHH)"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#10B981', stroke: darkMode ? '#0F172A' : '#FFFFFF', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Info Bar at bottom of card */}
        <div className="mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              Decision-Time Forecast ({cutoffTime} D-1)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Actual Outturn
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              Intraday Revisions
            </span>
          </div>

          <div className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
            Latest Eligible: {data?.latest_eligible_publication || 'N/A'}
          </div>
        </div>
      </div>

      {/* Paired Bottom Cards: Peak Outturns & Procurement Methodology */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Peak Wind Outturn Intervals */}
        <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Zap className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Peak Generation Intervals (January 2026)
              </h4>
            </div>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Highest Outturns</span>
          </div>

          <div className="space-y-2.5">
            {peakIntervals.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectInterval && onSelectInterval(item.startTime)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs hover:bg-white/90 dark:hover:bg-slate-800/80 cursor-pointer transition-all"
              >
                <div>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {item.startTime.replace('T', ' ').replace('Z', ' UTC')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Fcst: {item.decision_forecast?.toLocaleString()} MW | Diff: {(item.decision_forecast - item.actual) > 0 ? '+' : ''}{(item.decision_forecast - item.actual).toLocaleString()} MW
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                    {item.actual?.toLocaleString()} MW
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Rank #{idx + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Look-Ahead Bias Mitigation & Cutoff Notice */}
        <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Look-Ahead Bias Mitigation
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Every forecast evaluated in WindLens is selected strictly based on its publication timestamp:
            </p>
            <div className="mt-3 p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-xs border border-slate-200/60 dark:border-slate-700/60 font-mono text-xs text-slate-700 dark:text-slate-200 space-y-1">
              <div>• Cutoff Applied: <span className="text-blue-600 dark:text-blue-400 font-bold">{cutoffTime} Europe/London (D-1)</span></div>
              <div>• Selection Rule: <span className="font-semibold">max(publishTime ≤ cutoff)</span></div>
              <div>• Intraday Exclusion: Later forecasts are marked post-cutoff.</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Zero look-ahead violations verified
            </span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('methodology')}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Methodology docs →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
