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
import { Wind, Clock, ShieldCheck, Calendar, Filter, ArrowUpRight } from 'lucide-react';

export default function Dashboard({
  cutoffTime,
  resolution,
  startDate,
  endDate,
  onSelectInterval,
  onNavigateTab,
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

  return (
    <div className="space-y-6">
      {/* Top Banner: Decision-Time Methodology Notice */}
      <div className="rounded-xl border border-sky-900/50 bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-sky-900/40 text-sky-400 border border-sky-800/40">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100">
                  Day-Ahead Procurement Cutoff: {cutoffTime} Europe/London (D-1)
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-sky-900/50 text-sky-300 border border-sky-700/50">
                  Strict Look-Ahead Bias Mitigation
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Every delivery interval below displays the forecast available prior to the day-ahead procurement decision cutoff (11:00 D-1 auction default). Later forecast revisions published closer to delivery are classified as post-cutoff intraday.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto text-xs">
            <div className="text-right">
              <span className="text-slate-500 block">Latest Eligible Publication</span>
              <span className="font-mono text-sky-300 font-medium">
                {data?.latest_eligible_publication || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Decision-Time Forecast Avg"
          value={avgDecision}
          unit="MW"
          subtitle={`Across ${validDecision.length} intervals`}
          tooltip="Average expected national wind generation at day-ahead cutoff time."
          variant="primary"
        />
        <KPICard
          title="Actual Outturn Avg"
          value={avgActual}
          unit="MW"
          subtitle={`Across ${validActual.length} intervals`}
          tooltip="Average metered national transmission-system wind generation from Elexon FUELHH."
          variant="success"
        />
        <KPICard
          title="Forecast Coverage"
          value={`${coveragePercent}%`}
          unit=""
          subtitle={`${matched} of ${total} delivery intervals`}
          tooltip="Percentage of delivery intervals with an eligible day-ahead forecast published before cutoff."
          variant="neutral"
        />
        <KPICard
          title="Resolution Mode"
          value={resolution === 'exact_hourly' ? 'Hourly Averaged' : 'Half-Hour Mapped'}
          unit=""
          subtitle={resolution === 'exact_hourly' ? '744 delivery hours' : '1,488 settlement periods'}
          tooltip="Hourly averaged outturn ((A_:00 + A_:30) / 2) vs half-hourly settlement periods mapped from hourly forecasts."
          variant="warning"
        />
      </div>

      {/* Main Time-Series Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Wind className="w-4 h-4 text-sky-400" />
              Wind Generation: Decision-Time Forecast vs Actual vs Latest Available
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Compare what the procurement desk saw at the Day-Ahead cutoff ({cutoffTime} D-1) vs outturn and final gate forecasts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab && onNavigateTab('accuracy')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
            >
              Inspect Accuracy Metrics
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                dy={8}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                unit=" MW"
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                }}
                labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}
                formatter={(val, name) => {
                  const labelMap = {
                    decisionForecast: ['Decision-Time Forecast (at Cutoff)', ' MW'],
                    latestForecast: ['Latest Available Forecast', ' MW'],
                    actual: ['Actual Generation', ' MW'],
                  };
                  return [`${Number(val).toLocaleString()} MW`, labelMap[name] ? labelMap[name][0] : name];
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="decisionForecast"
                name="Decision-Time Forecast"
                stroke="#0284c7"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="latestForecast"
                name="Latest Available Forecast"
                stroke="#818cf8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Generation"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              Decision-Time Forecast (Strict Cutoff)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              Latest Available Forecast (Intraday updates)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Actual Outturn (FUELHH)
            </span>
          </div>
          <span className="text-slate-500 italic">Click an interval in the Accuracy or History tab to view revision steps.</span>
        </div>
      </div>
    </div>
  );
}
