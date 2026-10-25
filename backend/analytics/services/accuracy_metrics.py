"""
Accuracy metrics calculation engine for WindLens.
Computes MAE, RMSE, Mean Forecast Bias, WAPE, error distributions,
energy volume totals (MWh), top forecast misses, and daily summaries with zero-denominator safety.
"""

import math
from typing import Dict, List, Optional, Any
import numpy as np


class AccuracyCalculator:
    """Calculates quantitative forecast accuracy metrics with strict validation."""

    @staticmethod
    def calculate_summary_metrics(matched_series: List[Dict]) -> Dict[str, Any]:
        """
        Calculate overall summary accuracy metrics for valid matched intervals.
        Handles zero denominators explicitly.
        
        Units and Quantities:
        - MAE, RMSE, Bias: Megawatts (MW) [Power]
        - WAPE: Percentage (%) [Ratio of total absolute error to total actual generation]
        - Mean Generation: Megawatts (MW) [Average active power]
        - Total Energy: Megawatt-hours (MWh) [Energy = Power (MW) x Duration (hours)]
        """
        valid_items = [
            m for m in matched_series
            if m.get('actual') is not None and m.get('decision_forecast') is not None
        ]

        n = len(valid_items)
        if n == 0:
            return {
                'valid_matched_count': 0,
                'mae_mw': None,
                'rmse_mw': None,
                'bias_mw': None,
                'wape_percent': None,
                'mean_actual_mw': None,
                'mean_forecast_mw': None,
                'total_actual_energy_mwh': None,
                'total_forecast_energy_mwh': None,
                'total_actual_mw': None,
                'total_forecast_mw': None,
                'max_overforecast_mw': None,
                'max_underforecast_mw': None,
                'status': 'no_valid_data',
            }

        actuals = np.array([float(m['actual']) for m in valid_items], dtype=np.float64)
        forecasts = np.array([float(m['decision_forecast']) for m in valid_items], dtype=np.float64)

        # Durations in hours (defaults to 1.0 if not specified, 0.5 for half-hourly)
        durations = np.array([float(m.get('interval_duration_hours', 1.0)) for m in valid_items], dtype=np.float64)

        errors = forecasts - actuals
        abs_errors = np.abs(errors)

        # MAE = sum(|F - A|) / n (MW)
        mae = float(np.mean(abs_errors))

        # RMSE = sqrt(sum((F - A)^2) / n) (MW)
        rmse = float(np.sqrt(np.mean(errors ** 2)))

        # Mean Forecast Bias = sum(F - A) / n (MW)
        bias = float(np.mean(errors))

        # WAPE = 100 * sum(|F - A|) / sum(|A|) (%)
        sum_actuals = float(np.sum(np.abs(actuals)))
        if sum_actuals > 0:
            wape = float((np.sum(abs_errors) / sum_actuals) * 100.0)
        else:
            wape = None  # Undefined denominator: sum of actuals is zero

        # Physical Energy Volume: Energy (MWh) = Power (MW) * Duration (hours)
        total_actual_energy_mwh = float(np.sum(actuals * durations))
        total_forecast_energy_mwh = float(np.sum(forecasts * durations))

        # Metrics for latest available gate forecast (for comparison)
        latest_valid = [
            m for m in matched_series
            if m.get('actual') is not None and m.get('latest_forecast') is not None
        ]
        latest_mae, latest_rmse, latest_bias, latest_wape = None, None, None, None
        if latest_valid:
            l_acts = np.array([float(m['actual']) for m in latest_valid], dtype=np.float64)
            l_fcsts = np.array([float(m['latest_forecast']) for m in latest_valid], dtype=np.float64)
            l_errs = l_fcsts - l_acts
            l_abs_errs = np.abs(l_errs)
            latest_mae = float(np.mean(l_abs_errs))
            latest_rmse = float(np.sqrt(np.mean(l_errs ** 2)))
            latest_bias = float(np.mean(l_errs))
            l_sum_acts = float(np.sum(np.abs(l_acts)))
            if l_sum_acts > 0:
                latest_wape = float((np.sum(l_abs_errs) / l_sum_acts) * 100.0)

        return {
            'valid_matched_count': n,
            'mae_mw': round(mae, 2),
            'rmse_mw': round(rmse, 2),
            'bias_mw': round(bias, 2),
            'wape_percent': round(wape, 2) if wape is not None else None,
            'mean_actual_mw': round(float(np.mean(actuals)), 2),
            'mean_forecast_mw': round(float(np.mean(forecasts)), 2),
            'total_actual_energy_mwh': round(total_actual_energy_mwh, 1),
            'total_forecast_energy_mwh': round(total_forecast_energy_mwh, 1),
            'total_actual_mw': round(float(np.sum(actuals)), 2),
            'total_forecast_mw': round(float(np.sum(forecasts)), 2),
            'max_overforecast_mw': round(float(np.max(errors)), 2),
            'max_underforecast_mw': round(float(np.min(errors)), 2),
            'latest_available_comparison': {
                'mae_mw': round(latest_mae, 2) if latest_mae is not None else None,
                'rmse_mw': round(latest_rmse, 2) if latest_rmse is not None else None,
                'bias_mw': round(latest_bias, 2) if latest_bias is not None else None,
                'wape_percent': round(latest_wape, 2) if latest_wape is not None else None,
            } if latest_valid else None,
            'units': {
                'mae': 'MW',
                'rmse': 'MW',
                'bias': 'MW',
                'wape': '%',
                'generation': 'MW',
                'energy': 'MWh',
            }
        }

    @staticmethod
    def get_top_forecast_misses(matched_series: List[Dict], limit: int = 10) -> Dict[str, List[Dict]]:
        """
        Extract the largest forecast errors:
        - Top over-forecasts (Forecast >> Actual, positive error)
        - Top under-forecasts (Forecast << Actual, negative error)
        - Largest absolute misses
        """
        valid = [
            m for m in matched_series
            if m.get('error') is not None and m.get('abs_error') is not None
        ]

        top_over = sorted(valid, key=lambda x: x['error'], reverse=True)[:limit]
        top_under = sorted(valid, key=lambda x: x['error'])[:limit]
        top_abs = sorted(valid, key=lambda x: x['abs_error'], reverse=True)[:limit]

        return {
            'largest_overforecasts': top_over,
            'largest_underforecasts': top_under,
            'largest_absolute_misses': top_abs,
        }

    @staticmethod
    def calculate_daily_summary(matched_series: List[Dict]) -> List[Dict]:
        """Aggregate accuracy metrics by delivery calendar date."""
        from collections import defaultdict
        by_date = defaultdict(list)

        for m in matched_series:
            st = m.get('startTime')
            if not st or m.get('actual') is None or m.get('decision_forecast') is None:
                continue
            day_str = st[:10]  # YYYY-MM-DD
            by_date[day_str].append(m)

        daily_results = []
        for day_str in sorted(by_date.keys()):
            items = by_date[day_str]
            acts = np.array([float(x['actual']) for x in items])
            fcsts = np.array([float(x['decision_forecast']) for x in items])
            durs = np.array([float(x.get('interval_duration_hours', 1.0)) for x in items])
            errs = fcsts - acts
            abs_errs = np.abs(errs)

            sum_acts = float(np.sum(np.abs(acts)))
            wape = float((np.sum(abs_errs) / sum_acts) * 100.0) if sum_acts > 0 else None

            daily_results.append({
                'date': day_str,
                'intervals_count': len(items),
                'mae_mw': round(float(np.mean(abs_errs)), 2),
                'rmse_mw': round(float(np.sqrt(np.mean(errs ** 2))), 2),
                'bias_mw': round(float(np.mean(errs)), 2),
                'wape_percent': round(wape, 2) if wape is not None else None,
                'actual_avg_mw': round(float(np.mean(acts)), 2),
                'forecast_avg_mw': round(float(np.mean(fcsts)), 2),
                'actual_energy_mwh': round(float(np.sum(acts * durs)), 1),
                'forecast_energy_mwh': round(float(np.sum(fcsts * durs)), 1),
            })

        return daily_results
