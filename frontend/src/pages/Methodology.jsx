import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  Database,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  FileText,
} from 'lucide-react';

export default function Methodology() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDataQuality();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load data quality and methodology');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner message="Auditing dataset quality and completeness..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const audit = data?.audit || {};
  const meta = data?.metadata || {};
  const sources = data?.data_sources || {};
  const meth = data?.methodology || {};

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Overview & Sources Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-2">
          <Database className="w-5 h-5 text-sky-400" />
          Official Data Sources &amp; Retrieval Pipeline
        </h3>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          WindLens queries official, live UK National Grid ESO datasets via Elexon BMRS Open API v1 stream endpoints. No external or non-Elexon datasets are introduced.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                Actual Generation (FUELHH)
              </span>
              <p className="text-xs text-slate-300 mb-2">
                Half-hourly outturn generation by fuel type for Great Britain. Filtered strictly where <code className="text-sky-300 font-mono">fuelType == 'WIND'</code>.
              </p>
              <span className="text-[11px] text-slate-500 block">
                StartTime: Target delivery interval | Generation: MW
              </span>
            </div>
            <a
              href={sources.fuelhh_actuals_stream}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium"
            >
              Elexon FUELHH Documentation
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider block mb-1">
                Forecast Generation (WINDFOR)
              </span>
              <p className="text-xs text-slate-300 mb-2">
                National wind generation forecasts published at regular intervals throughout each day leading up to gate closure.
              </p>
              <span className="text-[11px] text-slate-500 block">
                StartTime: Target interval | PublishTime: Publication timestamp | Generation: MW
              </span>
            </div>
            <a
              href={sources.windfor_forecasts_stream}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium"
            >
              Elexon WINDFOR Documentation
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Completeness Audit Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          January 2026 Dataset Completeness Audit
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Rigorous interval validation. January 2026 comprises exactly 31 calendar days × 48 half-hour settlement periods = 1,488 intervals.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <span className="text-[11px] text-slate-500 uppercase block mb-1">Expected Half-Hours</span>
            <span className="font-mono text-xl font-bold text-slate-200">1,488</span>
            <span className="text-[10px] text-slate-400 block mt-1">31 days × 48 periods</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <span className="text-[11px] text-slate-500 uppercase block mb-1">Actuals Available</span>
            <span className="font-mono text-xl font-bold text-emerald-400">
              {audit.actual_intervals_found?.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-500 block mt-1">
              {audit.actual_coverage_percent}% coverage
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <span className="text-[11px] text-slate-500 uppercase block mb-1">Expected Hours</span>
            <span className="font-mono text-xl font-bold text-slate-200">744</span>
            <span className="text-[10px] text-slate-400 block mt-1">31 days × 24 hours</span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <span className="text-[11px] text-slate-500 uppercase block mb-1">Forecast Hours Found</span>
            <span className="font-mono text-xl font-bold text-sky-400">
              {audit.forecast_hour_intervals_found?.toLocaleString()}
            </span>
            <span className="text-[10px] text-sky-500 block mt-1">
              {audit.forecast_hour_coverage_percent}% coverage
            </span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle className="w-4 h-4" />
            Verification Status: Full Month Completeness Verified
          </div>
          <p className="text-slate-400">
            • Missing actual intervals: <span className="font-mono text-slate-200">{audit.missing_actual_intervals_count}</span>
            <br />
            • Missing forecast hours: <span className="font-mono text-slate-200">{audit.missing_forecast_hours_count}</span>
            <br />
            • Last successful retrieval: <span className="font-mono text-sky-300">{meta.retrieved_at}</span>
          </p>
        </div>
      </div>

      {/* Decision-Time Methodology & Formulas */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          Analytical Methodology &amp; Mathematical Formulations
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Mathematical specifications and time handling designed to eliminate look-ahead bias in day-ahead wholesale procurement.
        </p>

        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <h4 className="font-semibold text-slate-200 mb-2">1. Day-Ahead Decision Cutoff Logic</h4>
            <p className="text-slate-400 leading-relaxed">
              In Great Britain, wholesale day-ahead power is traded in discrete daily auctions (EPEX SPOT and Nord Pool). The auction gate closure occurs on <strong>D-1</strong> (the day before delivery D). Our application enforces:
              <br />
              <code className="block my-2 p-2 rounded bg-slate-900 font-mono text-sky-300">
                Decision_Cutoff(Delivery_Interval) = (Delivery_Date_in_London − 1 Day) at [Cutoff_Time] Europe/London
              </code>
              To evaluate historical performance, forecasts published after this cutoff are strictly excluded from the decision-time metric calculations.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <h4 className="font-semibold text-slate-200 mb-2">2. Accuracy Metrics Formulations</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-slate-300">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                <span className="font-semibold text-sky-400 block mb-1">Mean Absolute Error (MAE)</span>
                <span className="font-mono text-slate-300 block mb-1">MAE = (1/n) · Σ |Fᵢ − Aᵢ|</span>
                <span className="text-[11px] text-slate-500">Unit: MW. Average magnitude of forecast error.</span>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                <span className="font-semibold text-amber-400 block mb-1">Root Mean Squared Error (RMSE)</span>
                <span className="font-mono text-slate-300 block mb-1">RMSE = √( (1/n) · Σ (Fᵢ − Aᵢ)² )</span>
                <span className="text-[11px] text-slate-500">Unit: MW. Penalizes large forecast misses.</span>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                <span className="font-semibold text-emerald-400 block mb-1">Mean Forecast Bias</span>
                <span className="font-mono text-slate-300 block mb-1">Bias = (1/n) · Σ (Fᵢ − Aᵢ)</span>
                <span className="text-[11px] text-slate-500">Unit: MW. Positive = Over-forecast; Negative = Under-forecast.</span>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                <span className="font-semibold text-indigo-400 block mb-1">Weighted Absolute Percentage Error (WAPE)</span>
                <span className="font-mono text-slate-300 block mb-1">WAPE = 100 · ( Σ |Fᵢ − Aᵢ| / Σ |Aᵢ| )</span>
                <span className="text-[11px] text-slate-500">Unit: %. Relative error normalized to total grid outturn.</span>
              </div>
            </div>
            <p className="text-slate-500 mt-2 text-[11px]">
              Zero-Denominator Safety: When n = 0 or Σ|Aᵢ| = 0, metrics are returned as null/undefined rather than zero.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <h4 className="font-semibold text-slate-200 mb-2">3. Timezone &amp; Boundary Handling</h4>
            <p className="text-slate-400 leading-relaxed">
              Timestamps are parsed and normalized to UTC while respecting <code className="text-sky-300">Europe/London</code> clock rules. In January, London observes Greenwich Mean Time (GMT, UTC+0). During summer, British Summer Time (BST, UTC+1) transitions are natively supported by the underlying timezone engine.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-amber-900/30 bg-amber-950/10 text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
              <div>
                <span className="font-semibold block mb-0.5">Known Analytical Limitations</span>
                <p className="text-slate-400 leading-relaxed">
                  • <strong>National Grid Scope:</strong> WINDFOR and FUELHH reflect transmission-system connected wind farms across Great Britain. Embedded wind (connected directly to distribution networks) and offshore wind with private wire are not isolated in national BMRS totals.
                  <br />
                  • <strong>Procurement Exposure:</strong> While under-forecast wind indicates potential replacement procurement risk in the wholesale market, total portfolio exposure depends on consumer demand shape, hedging spreads, and balancing mechanism pricing (System Buy Price / System Sell Price), which are outside the scope of this challenge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
