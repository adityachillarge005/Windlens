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
  Zap,
} from 'lucide-react';

export default function Accuracy({
  cutoffTime,
  resolution,
  startDate,
  endDate,
  onSelectInterval,
  darkMode,
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
      {/* Primary Accuracy KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Mean Absolute Error (MAE)"
          value={metrics.mae_mw}
          unit="MW"
          subtitle="Typical deviation magnitude"
          comparison={
            metrics.latest_available_comparison?.mae_mw
              ? `vs ${metrics.latest_available_comparison.mae_mw} MW (Latest)`
              : null
          }
          tooltip="MAE = (1/n) * sum(|Forecast - Actual|). Measures typical day-ahead volume deviations without penalizing large errors disproportionately."
          variant="primary"
          sparkline={true}
        />

        <KPICard
          title="Root Mean Squared Error (RMSE)"
          value={metrics.rmse_mw}
          unit="MW"
          subtitle="Quadratic penalty for extreme misses"
          comparison={
            metrics.latest_available_comparison?.rmse_mw
              ? `vs ${metrics.latest_available_comparison.rmse_mw} MW (Latest)`
              : null
          }
          tooltip="RMSE = sqrt((1/n) * sum((Forecast - Actual)^2)). Provides stronger penalties for large forecast misses, which cause the greatest wholesale balancing exposure."
          variant="neutral"
          sparkline={true}
        />

        <KPICard
          title="Mean Forecast Bias"
          value={metrics.bias_mw}
          unit="MW"
          subtitle={
            metrics.bias_mw > 0
              ? 'Over-Forecast (+ Long)'
              : metrics.bias_mw < 0
              ? 'Under-Forecast (- Short)'
              : 'Zero Systematic Bias'
          }
          comparison={metrics.bias_mw > 0 ? '+ Over-forecast' : '- Under-forecast'}
          tooltip="Bias = (1/n) * sum(Forecast - Actual). Positive indicates systematic over-forecasting (buying excess day-ahead volume). Negative indicates short positions."
          variant={metrics.bias_mw > 0 ? 'warning' : 'primary'}
          sparkline={true}
        />

        <KPICard
          title="WAPE (%)"
          value={metrics.wape_percent}
          unit="%"
          subtitle="Normalized by actual volume"
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
        <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Actual Energy
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {metrics.total_actual_energy_mwh ? Number(metrics.total_actual_energy_mwh).toLocaleString() : '—'} MWh
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Metered Outturn Volume</span>
          </div>
          <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
            {metrics.resolution === 'exact_hourly' ? '1.0h periods' : '0.5h periods'}
          </span>
        </div>

        <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Forecast Energy
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
              {metrics.total_forecast_energy_mwh ? Number(metrics.total_forecast_energy_mwh).toLocaleString() : '—'} MWh
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Day-Ahead Expected Volume</span>
          </div>
          <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
            Cutoff {cutoffTime} D-1
          </span>
        </div>

        <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Energy Net Imbalance
            </span>
            <span className={`text-base sm:text-lg font-bold font-mono ${
              (metrics.total_forecast_energy_mwh - metrics.total_actual_energy_mwh) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
            }`}>
              {metrics.total_forecast_energy_mwh && metrics.total_actual_energy_mwh
                ? `${((metrics.total_forecast_energy_mwh - metrics.total_actual_energy_mwh) > 0 ? '+' : '')}${Number((metrics.total_forecast_energy_mwh - metrics.total_actual_energy_mwh).toFixed(1)).toLocaleString()} MWh`
                : '—'}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">MWh = MW × duration_hours</span>
          </div>
          <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
            {metrics.matched_intervals || 0} intervals
          </span>
        </div>
      </div>

      {/* Procurement Impact Context Callout */}
      <div className="rounded-2xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 backdrop-blur-md p-4 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <span className="font-bold text-slate-900 dark:text-white">Procurement Context for UK Day-Ahead Decisions:</span>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              In the UK wholesale power market, day-ahead procurement commits volume ahead of delivery. An aggregate over-forecast (+{metrics.bias_mw || 0} MW bias) indicates that day-ahead forecasts persistently exceeded outturn, causing market participants to contract long positions subject to intraday re-trading or system cash-out. Conversely, an under-forecast creates short positions requiring replacement power in the Balancing Mechanism. Note that portfolio financial impact depends on market price spreads and balancing cash-out prices.
            </p>
          </div>
        </div>
      </div>

      {/* Main Chart: Forecast vs Actual Generation Over Time */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Decision-Time Forecast vs Actual Outturn (January 2026)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hourly comparison across all {metrics.matched_intervals || 0} evaluated intervals
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesChartData} margin={{ top: 10, right: 15, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1E293B' : '#F1F5F9'} vertical={false} />
              <XAxis dataKey="time" stroke={darkMode ? '#64748B' : '#94A3B8'} fontSize={11} tickLine={false} axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }} dy={8} />
              <YAxis stroke={darkMode ? '#64748B' : '#94A3B8'} fontSize={11} tickLine={false} axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }} unit=" MW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
                  borderColor: darkMode ? '#334155' : '#E2E8F0',
                  color: darkMode ? '#F1F5F9' : '#0F172A',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  fontSize: '0.75rem',
                }}
                formatter={(val, name) => [
                  <span style={{ fontWeight: 600, color: name === 'decisionForecast' ? '#3B82F6' : '#10B981' }}>
                    {Number(val).toLocaleString()} MW
                  </span>,
                  name === 'decisionForecast' ? 'Decision Forecast (D-1)' : 'Actual Generation',
                ]}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="decisionForecast"
                name="Decision Forecast (D-1)"
                stroke="#2563EB"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#2563EB', stroke: darkMode ? '#0F172A' : '#FFFFFF', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Generation"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#10B981', stroke: darkMode ? '#0F172A' : '#FFFFFF', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Error Residuals & Scatter Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Over Time Bar Chart */}
        <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Forecast Error Residuals (Forecast − Actual)
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Positive bars indicate over-forecast; negative bars indicate under-forecast.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1E293B' : '#F1F5F9'} vertical={false} />
                <XAxis dataKey="time" stroke={darkMode ? '#64748B' : '#94A3B8'} fontSize={10} tickLine={false} axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }} dy={8} />
                <YAxis stroke={darkMode ? '#64748B' : '#94A3B8'} fontSize={10} tickLine={false} axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }} unit=" MW" />
                <ReferenceLine y={0} stroke={darkMode ? '#64748B' : '#94A3B8'} strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
                    borderColor: darkMode ? '#334155' : '#E2E8F0',
                    color: darkMode ? '#F1F5F9' : '#0F172A',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '0.75rem',
                  }}
                  formatter={(val) => [
                    <span style={{ fontWeight: 600, color: val >= 0 ? '#F59E0B' : '#3B82F6' }}>
                      {Number(val).toLocaleString()} MW
                    </span>,
                    'Forecast Error',
                  ]}
                />
                <Bar dataKey="error" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scatter Plot: Forecast vs Actual */}
        <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Scatter Alignment: Forecast vs Outturn
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Diagonal alignment indicates perfect forecast accuracy.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 15, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1E293B' : '#F1F5F9'} />
                <XAxis
                  type="number"
                  dataKey="actual"
                  name="Actual"
                  unit=" MW"
                  stroke={darkMode ? '#64748B' : '#94A3B8'}
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }}
                />
                <YAxis
                  type="number"
                  dataKey="forecast"
                  name="Forecast"
                  unit=" MW"
                  stroke={darkMode ? '#64748B' : '#94A3B8'}
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: darkMode ? '#334155' : '#E2E8F0' }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
                    borderColor: darkMode ? '#334155' : '#E2E8F0',
                    color: darkMode ? '#F1F5F9' : '#0F172A',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '0.75rem',
                  }}
                  formatter={(val, name) => [`${Number(val).toLocaleString()} MW`, name]}
                />
                <Scatter name="Matched Intervals" data={scatterData} fill="#2563EB" opacity={0.65} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Deviations Section */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          Largest Forecast Deviations (Top Misses)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Over-Forecasts */}
          <div className="rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3">
              <TrendingUp className="w-4 h-4" />
              Top Over-Forecasts (Forecast &gt;&gt; Actual)
            </div>
            <div className="space-y-2">
              {(topMisses.largest_overforecasts || []).map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectInterval && onSelectInterval(m.startTime)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/50 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs cursor-pointer transition-all text-xs"
                >
                  <div>
                    <span className="font-mono text-slate-900 dark:text-slate-100 font-bold block">{m.startTime}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Actual: {m.actual?.toLocaleString()} MW | Fcst: {m.decision_forecast?.toLocaleString()} MW
                    </span>
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">
                    +{m.error?.toLocaleString()} MW
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Under-Forecasts */}
          <div className="rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-3">
              <TrendingDown className="w-4 h-4" />
              Top Under-Forecasts (Forecast &lt;&lt; Actual)
            </div>
            <div className="space-y-2">
              {(topMisses.largest_underforecasts || []).map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectInterval && onSelectInterval(m.startTime)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/50 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs cursor-pointer transition-all text-xs"
                >
                  <div>
                    <span className="font-mono text-slate-900 dark:text-slate-100 font-bold block">{m.startTime}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Actual: {m.actual?.toLocaleString()} MW | Fcst: {m.decision_forecast?.toLocaleString()} MW
                    </span>
                  </div>
                  <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">
                    {m.error?.toLocaleString()} MW
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interval Level Detail Table */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Interval-Level Forecast and Actual Records</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified dataset: 744 hourly delivery intervals with error residuals and cutoff timestamps.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search timestamp..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-950/70 backdrop-blur-xs border border-slate-200/80 dark:border-white/10 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] bg-slate-50/50 dark:bg-slate-800/40 backdrop-blur-xs">
                <th className="py-2.5 px-3 rounded-l-lg font-semibold">Delivery Interval (UTC)</th>
                <th className="py-2.5 px-3 font-semibold">Actual (MW)</th>
                <th className="py-2.5 px-3 font-semibold">Decision Forecast (MW)</th>
                <th className="py-2.5 px-3 font-semibold">Error (MW)</th>
                <th className="py-2.5 px-3 font-semibold">Abs Error (MW)</th>
                <th className="py-2.5 px-3 font-semibold">Cutoff Applied</th>
                <th className="py-2.5 px-3 text-right rounded-r-lg font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {paginatedRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 text-slate-900 dark:text-slate-200 font-medium">{row.startTime}</td>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                    {row.actual !== null ? row.actual.toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400 font-bold">
                    {row.decision_forecast !== null ? row.decision_forecast.toLocaleString() : '—'}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-bold ${
                      row.error > 0 ? 'text-amber-600 dark:text-amber-400' : row.error < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                    }`}
                  >
                    {row.error !== null ? (row.error > 0 ? `+${row.error}` : row.error) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                    {row.abs_error !== null ? row.abs_error : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">{row.cutoff_timestamp}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onSelectInterval && onSelectInterval(row.startTime)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      Revisions
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100/80 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredTable.length)} of {filteredTable.length} intervals
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 font-mono font-medium text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
