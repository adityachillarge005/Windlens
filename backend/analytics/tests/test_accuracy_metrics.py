"""
Unit tests for AccuracyCalculator.
SYNTHETIC TEST FIXTURES: All numerical data in this file is synthetically constructed.
"""

import math
import unittest
from analytics.services.accuracy_metrics import AccuracyCalculator


class TestAccuracyMetrics(unittest.TestCase):
    """Test suite for analytical accuracy calculations and edge case handling."""

    def test_standard_metrics_calculation(self):
        """
        Synthetic test:
        Interval 1: F = 100, A = 80  -> Error = +20, Abs = 20, Sq = 400
        Interval 2: F = 150, A = 200 -> Error = -50, Abs = 50, Sq = 2500
        Interval 3: F = 120, A = 120 -> Error =   0, Abs =  0, Sq = 0
        
        n = 3
        Sum Abs = 70 -> MAE = 70 / 3 = 23.33 MW
        Sum Sq = 2900 -> RMSE = sqrt(2900 / 3) = sqrt(966.6667) = 31.09 MW
        Sum Error = -30 -> Bias = -30 / 3 = -10.0 MW
        Sum Actual = 400 -> WAPE = 100 * (70 / 400) = 17.5 %
        """
        synthetic_series = [
            {'startTime': '2026-01-01T00:00:00Z', 'actual': 80.0, 'decision_forecast': 100.0, 'error': 20.0, 'abs_error': 20.0},
            {'startTime': '2026-01-01T01:00:00Z', 'actual': 200.0, 'decision_forecast': 150.0, 'error': -50.0, 'abs_error': 50.0},
            {'startTime': '2026-01-01T02:00:00Z', 'actual': 120.0, 'decision_forecast': 120.0, 'error': 0.0, 'abs_error': 0.0},
        ]

        metrics = AccuracyCalculator.calculate_summary_metrics(synthetic_series)

        self.assertEqual(metrics['valid_matched_count'], 3)
        self.assertAlmostEqual(metrics['mae_mw'], 23.33, places=2)
        self.assertAlmostEqual(metrics['rmse_mw'], 31.09, places=2)
        self.assertAlmostEqual(metrics['bias_mw'], -10.00, places=2)
        self.assertAlmostEqual(metrics['wape_percent'], 17.50, places=2)
        self.assertEqual(metrics['max_overforecast_mw'], 20.0)
        self.assertEqual(metrics['max_underforecast_mw'], -50.0)

    def test_zero_denominator_empty_series(self):
        """Synthetic test: When no valid intervals exist, return None instead of division by zero."""
        synthetic_series = [
            {'startTime': '2026-01-01T00:00:00Z', 'actual': None, 'decision_forecast': 100.0},
            {'startTime': '2026-01-01T01:00:00Z', 'actual': 50.0, 'decision_forecast': None},
        ]

        metrics = AccuracyCalculator.calculate_summary_metrics(synthetic_series)
        self.assertEqual(metrics['valid_matched_count'], 0)
        self.assertIsNone(metrics['mae_mw'])
        self.assertIsNone(metrics['rmse_mw'])
        self.assertIsNone(metrics['bias_mw'])
        self.assertIsNone(metrics['wape_percent'])

    def test_zero_actual_generation_denominator(self):
        """Synthetic test: When total actual generation is zero, WAPE denominator is 0."""
        synthetic_series = [
            {'startTime': '2026-01-01T00:00:00Z', 'actual': 0.0, 'decision_forecast': 10.0, 'error': 10.0, 'abs_error': 10.0},
            {'startTime': '2026-01-01T01:00:00Z', 'actual': 0.0, 'decision_forecast': 0.0, 'error': 0.0, 'abs_error': 0.0},
        ]

        metrics = AccuracyCalculator.calculate_summary_metrics(synthetic_series)
        self.assertEqual(metrics['valid_matched_count'], 2)
        self.assertEqual(metrics['mae_mw'], 5.0)
        # WAPE denominator sum(|Actual|) == 0 -> must be None, NOT zero or crash
        self.assertIsNone(metrics['wape_percent'])

    def test_top_forecast_misses(self):
        """Synthetic test: Extract largest over-forecasts and under-forecasts."""
        synthetic_series = [
            {'startTime': '2026-01-01T00:00:00Z', 'error': 500.0, 'abs_error': 500.0},
            {'startTime': '2026-01-01T01:00:00Z', 'error': -600.0, 'abs_error': 600.0},
            {'startTime': '2026-01-01T02:00:00Z', 'error': 100.0, 'abs_error': 100.0},
        ]

        misses = AccuracyCalculator.get_top_forecast_misses(synthetic_series, limit=1)
        self.assertEqual(len(misses['largest_overforecasts']), 1)
        self.assertEqual(misses['largest_overforecasts'][0]['error'], 500.0)

        self.assertEqual(len(misses['largest_underforecasts']), 1)
        self.assertEqual(misses['largest_underforecasts'][0]['error'], -600.0)

        self.assertEqual(len(misses['largest_absolute_misses']), 1)
        self.assertEqual(misses['largest_absolute_misses'][0]['abs_error'], 600.0)
