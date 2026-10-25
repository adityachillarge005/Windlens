"""
Unit tests for ForecastSelector and cutoff business logic.
SYNTHETIC TEST FIXTURES: All data in this file is synthetically generated for testing.
"""

from datetime import datetime, timezone
import unittest
from analytics.services.forecast_selection import ForecastSelector, compute_day_ahead_cutoff
from analytics.services.data_processing import LONDON_TZ, UTC_TZ


class TestForecastSelection(unittest.TestCase):
    """Test suite for forecast selection, cutoff calculation, and bias prevention."""

    def setUp(self):
        self.selector = ForecastSelector(cutoff_time_str="11:00")

    def test_compute_day_ahead_cutoff_standard(self):
        """Synthetic test: 2026-01-05 14:00 delivery should have cutoff at 2026-01-04 11:00."""
        delivery_dt = datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC_TZ)
        cutoff = compute_day_ahead_cutoff(delivery_dt, "11:00")
        self.assertEqual(cutoff.year, 2026)
        self.assertEqual(cutoff.month, 1)
        self.assertEqual(cutoff.day, 4)
        self.assertEqual(cutoff.hour, 11)
        self.assertEqual(cutoff.minute, 0)
        self.assertEqual(cutoff.tzinfo, UTC_TZ)

    def test_compute_day_ahead_cutoff_configurable(self):
        """Synthetic test: Cutoff with different hour parameter (12:00, 17:00)."""
        delivery_dt = datetime(2026, 1, 10, 0, 0, 0, tzinfo=UTC_TZ)
        cutoff_12 = compute_day_ahead_cutoff(delivery_dt, "12:00")
        cutoff_17 = compute_day_ahead_cutoff(delivery_dt, "17:00")
        self.assertEqual(cutoff_12.day, 9)
        self.assertEqual(cutoff_12.hour, 12)
        self.assertEqual(cutoff_17.day, 9)
        self.assertEqual(cutoff_17.hour, 17)

    def test_selection_strictly_before_cutoff(self):
        """
        Synthetic test: Ensure only forecasts published <= cutoff are eligible.
        Forecasts published after cutoff must NEVER be selected (Look-ahead bias check).
        """
        target_dt = datetime(2026, 1, 5, 12, 0, 0, tzinfo=UTC_TZ)
        cutoff_dt = datetime(2026, 1, 4, 11, 0, 0, tzinfo=UTC_TZ)

        synthetic_publications = [
            {'publishTime': '2026-01-04T08:00:00Z', 'generation': 1000.0},
            {'publishTime': '2026-01-04T10:30:00Z', 'generation': 1200.0}, # Latest eligible!
            {'publishTime': '2026-01-04T11:00:00Z', 'generation': 1300.0}, # Exactly at cutoff: eligible!
            {'publishTime': '2026-01-04T11:00:01Z', 'generation': 9999.0}, # Post-cutoff: strictly forbidden!
            {'publishTime': '2026-01-04T15:00:00Z', 'generation': 8888.0}, # Post-cutoff: strictly forbidden!
            {'publishTime': '2026-01-05T06:00:00Z', 'generation': 7777.0}, # Intraday: strictly forbidden!
        ]

        selected = self.selector.select_forecast_at_cutoff(target_dt, synthetic_publications, cutoff_dt)
        self.assertIsNotNone(selected)
        self.assertEqual(selected['publishTime'], '2026-01-04T11:00:00Z')
        self.assertEqual(selected['generation'], 1300.0)

    def test_selection_excludes_when_no_eligible_forecast(self):
        """Synthetic test: When all publications are post-cutoff, return None (no look-ahead)."""
        target_dt = datetime(2026, 1, 5, 12, 0, 0, tzinfo=UTC_TZ)
        cutoff_dt = datetime(2026, 1, 4, 11, 0, 0, tzinfo=UTC_TZ)

        synthetic_publications = [
            {'publishTime': '2026-01-04T14:00:00Z', 'generation': 1500.0},
            {'publishTime': '2026-01-05T08:00:00Z', 'generation': 1600.0},
        ]

        selected = self.selector.select_forecast_at_cutoff(target_dt, synthetic_publications, cutoff_dt)
        self.assertIsNone(selected)

    def test_matching_actuals_and_forecasts(self):
        """Synthetic test: End-to-end matching of synthetic actuals and forecasts."""
        synthetic_actuals = [
            {'startTime': '2026-01-05T12:00:00Z', 'generation': 1150.0},
            {'startTime': '2026-01-05T13:00:00Z', 'generation': 1250.0},
        ]
        synthetic_forecasts = [
            # For 12:00
            {'startTime': '2026-01-05T12:00:00Z', 'publishTime': '2026-01-04T09:00:00Z', 'generation': 1100.0},
            {'startTime': '2026-01-05T12:00:00Z', 'publishTime': '2026-01-04T14:00:00Z', 'generation': 1400.0},
            # For 13:00
            {'startTime': '2026-01-05T13:00:00Z', 'publishTime': '2026-01-04T10:00:00Z', 'generation': 1300.0},
        ]

        result = self.selector.match_forecasts_and_actuals(
            synthetic_actuals,
            synthetic_forecasts,
            cutoff_time_str="11:00",
            resolution="exact_hourly"
        )

        matched = result['matched_series']
        self.assertEqual(len(matched), 2)
        # Interval 12:00 should pick 09:00 publication (1100.0 MW), NOT 14:00 publication (1400.0 MW)
        self.assertEqual(matched[0]['decision_forecast'], 1100.0)
        self.assertEqual(matched[0]['actual'], 1150.0)
        self.assertEqual(matched[0]['error'], -50.0) # 1100 - 1150
        self.assertEqual(matched[0]['abs_error'], 50.0)

        # Interval 13:00 should pick 10:00 publication (1300.0 MW)
        self.assertEqual(matched[1]['decision_forecast'], 1300.0)
        self.assertEqual(matched[1]['actual'], 1250.0)
        self.assertEqual(matched[1]['error'], 50.0)

    def test_inspect_interval_revisions_tagging(self):
        """Synthetic test: Check revision deltas and category tagging."""
        synthetic_forecasts = [
            {'startTime': '2026-01-05T12:00:00Z', 'publishTime': '2026-01-04T06:00:00Z', 'generation': 1000.0},
            {'startTime': '2026-01-05T12:00:00Z', 'publishTime': '2026-01-04T10:00:00Z', 'generation': 1200.0},
            {'startTime': '2026-01-05T12:00:00Z', 'publishTime': '2026-01-04T18:00:00Z', 'generation': 1150.0},
        ]

        revs = self.selector.inspect_interval_revisions(
            '2026-01-05T12:00:00Z',
            synthetic_forecasts,
            cutoff_time_str="11:00"
        )
        pubs = revs['publications']
        self.assertEqual(len(pubs), 3)
        self.assertTrue(pubs[0]['is_eligible_at_cutoff'])
        self.assertFalse(pubs[0]['is_selected_decision_forecast'])
        self.assertTrue(pubs[1]['is_eligible_at_cutoff'])
        self.assertTrue(pubs[1]['is_selected_decision_forecast'])
        self.assertFalse(pubs[2]['is_eligible_at_cutoff'])
        self.assertEqual(pubs[1]['revision_delta_mw'], 200.0)
        self.assertEqual(pubs[2]['revision_delta_mw'], -50.0)
