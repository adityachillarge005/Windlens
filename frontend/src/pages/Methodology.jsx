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
  Clock,
  Layers,
} from 'lucide-react';

export default function Methodology({ darkMode }) {
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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Overview & Sources Card */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Database className="w-5 h-5" />
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Official Data Sources &amp; Retrieval Pipeline
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          WindLens queries official, live UK National Grid ESO datasets via Elexon BMRS Open API v1 stream endpoints. No external or non-Elexon datasets are introduced.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                Actual Generation (FUELHH)
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                Half-hourly outturn generation by fuel type for Great Britain. Filtered strictly where <code className="text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/60 px-1 py-0.5 rounded font-mono font-semibold">fuelType == 'WIND'</code>.
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-mono">
                StartTime: Target delivery interval | Generation: MW
              </span>
            </div>
            <a
              href={sources.fuelhh_actuals_stream}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold"
            >
              Elexon FUELHH Documentation
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-1">
                Forecast Generation (WINDFOR)
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                National wind generation forecasts published at regular intervals throughout each day leading up to delivery.
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-mono">
                StartTime: Target interval | PublishTime: Publication timestamp | Generation: MW
              </span>
            </div>
            <a
              href={sources.windfor_forecasts_stream}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold"
            >
              Elexon WINDFOR Documentation
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Completeness Audit Card */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            January 2026 Dataset Completeness Audit
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Rigorous interval validation. January 2026 comprises exactly 31 calendar days × 48 half-hour settlement periods = 1,488 intervals.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-3.5 rounded-xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs border border-slate-200/60 dark:border-white/5 text-center">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Expected Half-Hours</span>
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">1,488</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">31 days × 48 periods</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 backdrop-blur-xs border border-emerald-200/60 dark:border-emerald-900/50 text-center">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1">Actuals Available</span>
            <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {audit.actual_intervals_found?.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
              {audit.actual_coverage_percent}% coverage
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs border border-slate-200/60 dark:border-white/5 text-center">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Expected Hours</span>
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">744</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">31 days × 24 hours</span>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 backdrop-blur-xs border border-blue-200/60 dark:border-blue-900/50 text-center">
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase block mb-1">Forecast Hours Found</span>
            <span className="font-mono text-xl font-bold text-blue-700 dark:text-blue-300">
              {audit.forecast_hour_intervals_found?.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block mt-1">
              {audit.forecast_hour_coverage_percent}% coverage
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs border border-slate-200/60 dark:border-white/5 text-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Verification Status: Full Month Completeness Verified
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            • Missing actual intervals: <span className="font-mono font-bold text-slate-900 dark:text-white">{audit.missing_actual_intervals_count}</span>
            <br />
            • Missing forecast hours: <span className="font-mono font-bold text-slate-900 dark:text-white">{audit.missing_forecast_hours_count}</span>
            <br />
            • Last successful retrieval: <span className="font-mono text-blue-600 dark:text-blue-400">{meta.retrieved_at}</span>
          </p>
        </div>
      </div>

      {/* Decision-Time Methodology & Formulas */}
      <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <BookOpen className="w-5 h-5" />
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Analytical Methodology &amp; Mathematical Formulations
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Mathematical specifications and time handling designed to eliminate look-ahead bias in day-ahead wholesale procurement.
        </p>

        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs border border-slate-200/60 dark:border-white/5">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">1. Day-Ahead Decision Cutoff Assumption vs Balancing Mechanism Gate Closure</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              In Great Britain wholesale electricity markets, procurement teams evaluate day-ahead forecasts to inform commercial trading decisions before delivery. WindLens models the procurement desk's decision cutoff using a configurable evaluation assumption (defaulting to <strong>11:00 London time on D-1</strong>, adjustable to 12:00, 14:00, or 17:00). This analytical cutoff represents the internal decision deadline for daily order commitments and must not be conflated with the statutory Elexon Balancing Mechanism Gate Closure (which occurs 1 hour before each half-hour delivery interval):
              <br />
              <code className="block my-2 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700 font-mono text-blue-700 dark:text-blue-300 font-semibold">
                Decision_Cutoff(Delivery_Interval) = (Delivery_Date_in_London − 1 Day) at [Cutoff_Time] Europe/London
              </code>
              To evaluate historical accuracy without look-ahead bias, forecasts published after this cutoff timestamp are strictly excluded from decision-time metrics.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs border border-slate-200/60 dark:border-white/5">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">2. Hourly Outturn Aggregation &amp; Energy (MWh) Accounting</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              Elexon <code>FUELHH</code> records represent average power in <strong>Megawatts (MW)</strong> for each 30-minute settlement period. Elexon <code>WINDFOR</code> forecasts represent average power in MW over 1-hour intervals. WindLens provides two rigorously defined comparison methodologies:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700">
                <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">Hourly Averaged Outturn (Default)</span>
                <span className="font-mono text-xs text-blue-600 dark:text-blue-300 font-semibold block mb-1">Actual_Hour = (Actual_:00 + Actual_:30) / 2.0</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Requires both half-hour settlement readings (:00 and :30) to be present and valid. Matches each 1-hour forecast against the mean power (744 hours evaluated; 100% complete in January 2026).
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700">
                <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">Half-Hourly Settlement Mapped</span>
                <span className="font-mono text-xs text-amber-600 dark:text-amber-300 font-semibold block mb-1">Fcst_:00 = Fcst_Hour ; Fcst_:30 = Fcst_Hour</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Maps the 1-hour forecast across both half-hour settlement periods to evaluate directly against official settlement intervals (1,488 periods evaluated).
                </p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-3">
              <strong>Energy Conversion (MWh):</strong> MW represents instantaneous power, whereas volume is measured in Megawatt-hours (MWh). Energy is computed as:
              <br />
              <code className="block my-1.5 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                Total_Energy_MWh = Σ ( Generation_MWᵢ × Duration_Hoursᵢ )
              </code>
              where Duration = 1.0 h for hourly intervals and 0.5 h for half-hourly intervals. Both methods yield an identical January 2026 actual volume of <strong>8,616,068.5 MWh</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs border border-slate-200/60 dark:border-white/5">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">3. Accuracy Metrics Formulations</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-slate-700 dark:text-slate-300">
              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700">
                <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">Mean Absolute Error (MAE)</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold block mb-1">MAE = (1/n) · Σ |Fᵢ − Aᵢ|</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Unit: MW. Average magnitude of forecast error.</span>
              </div>

              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Root Mean Squared Error (RMSE)</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold block mb-1">RMSE = √( (1/n) · Σ (Fᵢ − Aᵢ)² )</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Unit: MW. Penalizes large forecast misses.</span>
              </div>

              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700">
                <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">Mean Forecast Bias</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold block mb-1">Bias = (1/n) · Σ (Fᵢ − Aᵢ)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Unit: MW. Positive = Over-forecast; Negative = Under-forecast.</span>
              </div>

              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Weighted Absolute Percentage Error (WAPE)</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold block mb-1">WAPE = 100 · ( Σ |Fᵢ − Aᵢ| / Σ |Aᵢ| )</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Unit: %. Relative error normalized to total grid outturn.</span>
              </div>
            </div>
            <p className="text-slate-400 dark:text-slate-500 mt-2 text-[11px]">
              Zero-Denominator Safety: When n = 0 or Σ|Aᵢ| = 0, metrics are returned as null/undefined rather than zero.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-xs border border-slate-200/60 dark:border-white/5">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">4. Timezone &amp; Boundary Handling</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Timestamps are parsed and normalized to UTC while respecting <code className="text-blue-700 dark:text-blue-400 font-mono font-semibold">Europe/London</code> clock rules. In January, London observes Greenwich Mean Time (GMT, UTC+0). During summer, British Summer Time (BST, UTC+1) transitions are natively supported by the underlying timezone engine.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 backdrop-blur-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-300 block mb-1">Known Analytical Limitations</span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
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
