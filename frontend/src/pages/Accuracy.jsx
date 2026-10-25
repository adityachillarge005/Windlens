import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  BarChart2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function Accuracy({
  cutoffTime,
  resolution,
  startDate,
  endDate,
  onSelectInterval,
}) {
  const [summaryData, setSummaryData] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumRes, serRes] = await Promise.all([
        api.getAccuracySummary({
          start_date: startDate,
          end_date: endDate,
          cutoff_time: cutoffTime,
          resolution: resolution,
        }),
        api.getAccuracySeries({
          start_date: startDate,
          end_date: endDate,
          cutoff_time: cutoffTime,
          resolution: resolution,
        }),
      ]);
      setSummaryData(sumRes);
      setSeriesData(serRes);
    } catch (err) {
      setError(err.message || 'Failed to load accuracy metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cutoffTime, resolution, startDate, endDate]);

  if (loading) return <LoadingSpinner message="Calculating accuracy metrics..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const metrics = summaryData?.metrics || {};
  const topMisses = summaryData?.top_misses || {};
  const rawSeries = seriesData?.matched_series || [];

  // Chart series mapping
  const timeSeriesChartData = rawSeries
    .filter((s) => s.actual !== null && s.decision_forecast !== null)
    .map((s) => ({
      time: s.startTime.substring(5, 16).replace('T', ' '),
      fullTime: s.startTime,
      actual: s.actual,
      decisionForecast: s.decision_forecast,
      error: s.error,
      absError: s.abs_error,
    }));

  // Scatter plot data
  const scatterData = rawSeries
    .filter((s) => s.actual !== null && s.decision_forecast !== null)
    .map((s) => ({
      actual: s.actual,
      forecast: s.decision_forecast,
      time: s.startTime,
    }));

  // Filter table records
  const filteredTable = rawSeries.filter((row) => {
    if (!tableSearch) return true;
    return (
      row.startTime.toLowerCase().includes(tableSearch.toLowerCase()) ||
      String(row.actual).includes(tableSearch) ||
      String(row.decision_forecast).includes(tableSearch)
    );
  });

  const totalPages = Math.ceil(filteredTable.length / pageSize) || 1;
  const paginatedRows = filteredTable.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Mean Absolute Error (MAE)"
          value={metrics.mae_mw}
          unit="MW"
          subtitle="Average absolute error magnitude"
          comparison={
            metrics.latest_available_comparison?.mae_mw
              ? `vs ${metrics.latest_available_comparison.mae_mw} MW (Latest)`
              : null
          }
          tooltip="MAE = (1/n) * sum(|Forecast - Actual|). Measures the typical magnitude of day-ahead volume deviations without penalizing large errors disproportionately."
          variant="primary"
        />

        <KPICard
          title="Root Mean Squared Error (RMSE)"
          value={metrics.rmse_mw}
          unit="MW"
          subtitle="Heavily penalizes extreme misses"
          comparison={
            metrics.latest_available_comparison?.rmse_mw
              ? `vs ${metrics.latest_available_comparison.rmse_mw} MW (Latest)`
              : null
          }
          tooltip="RMSE = sqrt((1/n) * sum((Forecast - Actual)^2)). Provides stronger penalties for large forecast misses, which cause the greatest wholesale balancing exposure."
          variant="warning"
        />

        <KPICard
          title="Mean Forecast Bias"
          value={metrics.bias_mw}
          unit="MW"
          subtitle={
            metrics.bias_mw > 0
              ? 'Tendency to Over-Forecast (+)'
              : metrics.bias_mw < 0
              ? 'Tendency to Under-Forecast (-)'
              : 'Zero Systematic Bias'
          }
          tooltip="Bias = (1/n) * sum(Forecast - Actual). A positive bias indicates persistent over-forecasting (buying too much day-ahead). Negative bias indicates under-forecasting (short positions)."
          variant={metrics.bias_mw > 0 ? 'warning' : 'primary'}
        />

        <KPICard
          title="WAPE (%)"
          value={metrics.wape_percent}
          unit="%"
          subtitle="Weighted Absolute % Error"
          comparison={
            metrics.latest_available_comparison?.wape_percent
              ? `vs ${metrics.latest_available_comparison.wape_percent}% (Latest)`
              : null
          }
          tooltip="WAPE = 100 * (sum(|F - A|) / sum(|A|)). Total absolute error divided by total actual wind generated. Normalizes error scale against total grid volume."
          variant="neutral"
        />
      </div>

      {/* Energy & Volume Distinction Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Total Actual Energy</span>
            <span className="text-base font-bold font-mono text-emerald-400">
              {metrics.total_actual_energy_mwh ? Number(metrics.total_actual_energy_mwh).toLocaleString() : '—'} MWh
            </span>
            <span className="text-[10px] text-slate-500 block">Metered Outturn Volume</span>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
            {metrics.resolution === 'exact_hourly' ? '1.0h periods' : '0.5h periods'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Total Forecast Energy</span>
            <span className="text-base font-bold font-mono text-sky-400">
              {metrics.total_forecast_energy_mwh ? Number(metrics.total_forecast_energy_mwh).toLocaleString() : '—'} MWh
            </span>
            <span className="text-[10px] text-slate-500 block">Day-Ahead Expected Volume</span>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
            Cutoff {cutoffTime} D-1
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Energy Net Imbalance</span>
            <span className={`text-base font-bold font-mono ${
              (metrics.total_forecast_energy_mwh - metrics.total_actual_energy_mwh) > 0 ? 'text-amber-400' : 'text-sky-400'
            }`}>
              {metrics.total_forecast_energy_mwh && metrics.total_actual_energy_mwh
                ? `${((metrics.total_forecast_energy_mwh - metrics.total_actual_energy_mwh) > 0 ? '+' : '')}${Number((metrics.total_forecast_energy_mwh - metrics.total_actual_energy_mwh).toFixed(1)).toLocaleString()} MWh`
                : '—'}
            </span>
            <span className="text-[10px] text-slate-500 block">MWh = MW × duration_hours</span>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
            {metrics.matched_intervals || 0} intervals
          </span>
        </div>
      </div>

      {/* Procurement Impact Callout */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-200">Procurement Context for UK Day-Ahead Decisions:</span>
            <p className="text-slate-400">
              In the UK wholesale market, wholesale day-ahead procurement decisions commit volumes ahead of delivery. An aggregate over-forecast (+{metrics.bias_mw || 0} MW bias) indicates that day-ahead forecasts persistently exceeded outturn, resulting in a contracted long volume position subject to intraday re-trading or system cash-out. Conversely, an under-forecast creates short positions requiring replacement power in the Balancing Mechanism. Note that portfolio commercial impact depends on market price spreads and balancing cash-out prices.
            </p>
          </div>
        </div>
      </div>

      {/* Forecast vs Actual Time Series */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-sky-400" />
          Decision-Time Forecast vs Actual Generation (January 2026)
        </h4>
        <p className="text-xs text-slate-400 mb-4">
          Time-series tracking of delivery intervals. Hover on any point to inspect MW levels.
        </p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} dy={8} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" MW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                }}
                formatter={(val, name) => [
                  `${Number(val).toLocaleString()} MW`,
                  name === 'decisionForecast' ? 'Decision Forecast (D-1)' : 'Actual Generation',
                ]}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="decisionForecast"
                name="Decision Forecast"
                stroke="#0284c7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Generation"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Error Over Time & Scatter Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Over Time (Residuals) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-amber-400" />
            Forecast Error Over Time (Error = Forecast − Actual)
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Positive bars indicate over-forecast; negative bars indicate under-forecast.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} dy={8} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit=" MW" />
                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                  }}
                  formatter={(val) => [`${Number(val).toLocaleString()} MW`, 'Forecast Error']}
                />
                <Bar dataKey="error" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scatter Plot: Forecast vs Actual */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-emerald-400" />
            Scatter Plot: Decision Forecast vs Actual Generation
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Points along the diagonal reference line indicate perfect forecast accuracy.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  dataKey="actual"
                  name="Actual"
                  unit=" MW"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="forecast"
                  name="Forecast"
                  unit=" MW"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                  }}
                  formatter={(val, name) => [`${Number(val).toLocaleString()} MW`, name]}
                />
                <Scatter name="Matched Intervals" data={scatterData} fill="#0ea5e9" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Largest Forecast Misses Section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          Largest Forecast Deviations (Top Misses)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Over-Forecasts */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              Top Over-Forecasts (Forecast &gt;&gt; Actual)
            </div>
            <div className="space-y-2">
              {(topMisses.largest_overforecasts || []).map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectInterval && onSelectInterval(m.startTime)}
                  className="flex items-center justify-between p-2 rounded bg-slate-900 hover:bg-slate-800 cursor-pointer transition-colors text-xs border border-slate-800/60"
                >
                  <div>
                    <span className="font-mono text-slate-300 font-medium">{m.startTime}</span>
                    <span className="text-slate-500 block text-[11px]">
                      Actual: {m.actual?.toLocaleString()} MW | Fcst: {m.decision_forecast?.toLocaleString()} MW
                    </span>
                  </div>
                  <span className="text-amber-400 font-semibold font-mono">
                    +{m.error?.toLocaleString()} MW
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Under-Forecasts */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 mb-2">
              <TrendingDown className="w-4 h-4" />
              Top Under-Forecasts (Forecast &lt;&lt; Actual)
            </div>
            <div className="space-y-2">
              {(topMisses.largest_underforecasts || []).map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectInterval && onSelectInterval(m.startTime)}
                  className="flex items-center justify-between p-2 rounded bg-slate-900 hover:bg-slate-800 cursor-pointer transition-colors text-xs border border-slate-800/60"
                >
                  <div>
                    <span className="font-mono text-slate-300 font-medium">{m.startTime}</span>
                    <span className="text-slate-500 block text-[11px]">
                      Actual: {m.actual?.toLocaleString()} MW | Fcst: {m.decision_forecast?.toLocaleString()} MW
                    </span>
                  </div>
                  <span className="text-sky-400 font-semibold font-mono">
                    {m.error?.toLocaleString()} MW
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interval Level Detail Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Interval-Level Forecast and Actual Records</h4>
            <p className="text-xs text-slate-400">
              Detailed breakdown of delivery intervals with error calculation and decision cutoff applied.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search timestamp..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Delivery Interval (UTC)</th>
                <th className="py-2.5 px-3">Actual (MW)</th>
                <th className="py-2.5 px-3">Decision Forecast (MW)</th>
                <th className="py-2.5 px-3">Error (MW)</th>
                <th className="py-2.5 px-3">Abs Error (MW)</th>
                <th className="py-2.5 px-3">Cutoff Applied</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {paginatedRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 text-slate-300 font-medium">{row.startTime}</td>
                  <td className="py-2 px-3 text-emerald-400 font-semibold">
                    {row.actual !== null ? row.actual.toLocaleString() : '—'}
                  </td>
                  <td className="py-2 px-3 text-sky-400 font-semibold">
                    {row.decision_forecast !== null ? row.decision_forecast.toLocaleString() : '—'}
                  </td>
                  <td
                    className={`py-2 px-3 font-semibold ${
                      row.error > 0 ? 'text-amber-400' : row.error < 0 ? 'text-sky-400' : 'text-slate-400'
                    }`}
                  >
                    {row.error !== null ? (row.error > 0 ? `+${row.error}` : row.error) : '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-300">
                    {row.abs_error !== null ? row.abs_error : '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-500 text-[11px]">{row.cutoff_timestamp}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => onSelectInterval && onSelectInterval(row.startTime)}
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
                    >
                      Inspect Revisions
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800 text-xs text-slate-400">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredTable.length)} of {filteredTable.length} intervals
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
