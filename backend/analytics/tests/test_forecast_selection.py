"""
Unit tests for ForecastSelector, cutoff business logic, and regression tests for look-ahead defense.
SYNTHETIC TEST FIXTURES: All data in this file is synthetically generated for testing.
"""

from datetime import datetime, timezone, timedelta
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
        Multiple eligible forecasts: select the latest eligible publication.
        """
        target_dt = datetime(2026, 1, 5, 12, 0, 0, tzinfo=UTC_TZ)
        cutoff_dt = datetime(2026, 1, 4, 11, 0, 0, tzinfo=UTC_TZ)

        synthetic_publications = [
            {'publishTime': '2026-01-04T08:00:00Z', 'generation': 1000.0},
            {'publishTime': '2026-01-04T10:30:00Z', 'generation': 1200.0}, # Latest eligible before cutoff
            {'publishTime': '2026-01-04T11:00:01Z', 'generation': 9999.0}, # Post-cutoff: strictly forbidden!
            {'publishTime': '2026-01-04T15:00:00Z', 'generation': 8888.0}, # Post-cutoff: strictly forbidden!
        ]

        selected = self.selector.select_forecast_at_cutoff(target_dt, synthetic_publications, cutoff_dt)
        self.assertIsNotNone(selected)
        self.assertEqual(selected['publishTime'], '2026-01-04T10:30:00Z')
        self.assertEqual(selected['generation'], 1200.0)

    def test_selection_exactly_at_cutoff_is_eligible(self):
        """Synthetic test: Publication published exactly at the cutoff (11:00:00Z) is eligible."""
        target_dt = datetime(2026, 1, 5, 12, 0, 0, tzinfo=UTC_TZ)
        cutoff_dt = datetime(2026, 1, 4, 11, 0, 0, tzinfo=UTC_TZ)

        synthetic_publications = [
            {'publishTime': '2026-01-04T10:00:00Z', 'generation': 1000.0},
            {'publishTime': '2026-01-04T11:00:00Z', 'generation': 1300.0}, # Exactly at cutoff: eligible!
            {'publishTime': '2026-01-04T11:00:01Z', 'generation': 9999.0}, # 1 second after: excluded!
        ]

        selected = self.selector.select_forecast_at_cutoff(target_dt, synthetic_publications, cutoff_dt)
        self.assertIsNotNone(selected)
        self.assertEqual(selected['publishTime'], '2026-01-04T11:00:00Z')
        self.assertEqual(selected['generation'], 1300.0)

    def test_selection_excludes_when_no_eligible_forecast(self):
        """Synthetic test: When all publications are post-cutoff, return None (no look-ahead fallback)."""
        target_dt = datetime(2026, 1, 5, 12, 0, 0, tzinfo=UTC_TZ)
        cutoff_dt = datetime(2026, 1, 4, 11, 0, 0, tzinfo=UTC_TZ)

        synthetic_publications = [
            {'publishTime': '2026-01-04T11:00:01Z', 'generation': 1500.0},
            {'publishTime': '2026-01-04T14:00:00Z', 'generation': 1600.0},
            {'publishTime': '2026-01-05T08:00:00Z', 'generation': 1700.0},
        ]

        selected = self.selector.select_forecast_at_cutoff(target_dt, synthetic_publications, cutoff_dt)
        self.assertIsNone(selected)

    def test_missing_and_invalid_timestamps_safely_ignored(self):
        """Synthetic test: Records with None, empty, or malformed publishTime are safely bypassed."""
        target_dt = datetime(2026, 1, 5, 12, 0, 0, tzinfo=UTC_TZ)
        cutoff_dt = datetime(2026, 1, 4, 11, 0, 0, tzinfo=UTC_TZ)

        synthetic_publications = [
            {'publishTime': None, 'generation': 500.0},
            {'publishTime': '', 'generation': 600.0},
            {'publishTime': 'not-a-valid-timestamp', 'generation': 700.0},
            {'publishTime': '2026-01-04T10:00:00Z', 'generation': 1100.0}, # Valid eligible
        ]

        selected = self.selector.select_forecast_at_cutoff(target_dt, synthetic_publications, cutoff_dt)
        self.assertIsNotNone(selected)
        self.assertEqual(selected['generation'], 1100.0)

    def test_mixed_timezone_representations(self):
        """
        Synthetic test: Ensure comparison parses actual UTC datetimes rather than lexicographical strings.
        2026-01-04T11:30:00+01:00 is 10:30:00 UTC (before 11:00:00 UTC cutoff).
        2026-01-04T12:00:00+01:00 is 11:00:00 UTC (at cutoff).
        2026-01-04T12:01:00+01:00 is 11:01:00 UTC (after cutoff).
        """
        target_dt = datetime(2026, 1, 5, 12, 0, 0, tzinfo=UTC_TZ)
        cutoff_dt = datetime(2026, 1, 4, 11, 0, 0, tzinfo=UTC_TZ)

        synthetic_publications = [
            {'publishTime': '2026-01-04T11:30:00+01:00', 'generation': 1050.0}, # 10:30 UTC
            {'publishTime': '2026-01-04T12:00:00+01:00', 'generation': 1250.0}, # 11:00 UTC (at cutoff)
            {'publishTime': '2026-01-04T12:01:00+01:00', 'generation': 9999.0}, # 11:01 UTC (post cutoff)
        ]

        selected = self.selector.select_forecast_at_cutoff(target_dt, synthetic_publications, cutoff_dt)
        self.assertIsNotNone(selected)
        self.assertEqual(selected['generation'], 1250.0)

    def test_latest_forecast_rejects_post_delivery_publications(self):
        """
        Synthetic test: select_latest_forecast must NEVER fall back to a forecast published after delivery.
        If all publications are after target_dt, it must return None.
        """
        target_dt = datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC_TZ)

        # Publications all published AFTER delivery interval start (14:00)
        post_delivery_pubs = [
            {'publishTime': '2026-01-05T14:15:00Z', 'generation': 2000.0},
            {'publishTime': '2026-01-05T14:30:00Z', 'generation': 2100.0},
        ]

        latest = self.selector.select_latest_forecast(target_dt, post_delivery_pubs)
        self.assertIsNone(latest) # STRICT ZERO LOOK-AHEAD: Must return None, NOT 2100.0!

    def test_latest_forecast_selects_latest_prior_to_delivery(self):
        """Synthetic test: select_latest_forecast picks the most recent publication at or before delivery."""
        target_dt = datetime(2026, 1, 5, 14, 0, 0, tzinfo=UTC_TZ)

        synthetic_pubs = [
            {'publishTime': '2026-01-04T10:00:00Z', 'generation': 1000.0},
            {'publishTime': '2026-01-05T13:30:00Z', 'generation': 1800.0}, # Latest before delivery
            {'publishTime': '2026-01-05T14:30:00Z', 'generation': 2200.0}, # Post-delivery: excluded
        ]

        latest = self.selector.select_latest_forecast(target_dt, synthetic_pubs)
        self.assertIsNotNone(latest)
        self.assertEqual(latest['publishTime'], '2026-01-05T13:30:00Z')
        self.assertEqual(latest['generation'], 1800.0)

    def test_hourly_averaged_actual_matching(self):
        """
        Synthetic test: For an hourly delivery window (12:00:00Z),
        actual is the arithmetic mean of the two 30-min settlement periods (:00 and :30).
        SP 25 (:00) = 1000 MW, SP 26 (:30) = 1200 MW -> Average Outturn = 1100 MW.
        """
        synthetic_actuals = [
            {'startTime': '2026-01-05T12:00:00Z', 'generation': 1000.0},
            {'startTime': '2026-01-05T12:30:00Z', 'generation': 1200.0},
        ]
        synthetic_forecasts = [
            {'startTime': '2026-01-05T12:00:00Z', 'publishTime': '2026-01-04T09:00:00Z', 'generation': 1150.0},
        ]

        result = self.selector.match_forecasts_and_actuals(
            synthetic_actuals,
            synthetic_forecasts,
            cutoff_time_str="11:00",
            resolution="exact_hourly"
        )

        matched = result['matched_series']
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]['actual'], 1100.0) # (1000 + 1200) / 2
        self.assertEqual(matched[0]['decision_forecast'], 1150.0)
        self.assertEqual(matched[0]['error'], 50.0) # 1150 - 1100
        self.assertEqual(matched[0]['abs_error'], 50.0)
        self.assertEqual(matched[0]['interval_duration_hours'], 1.0)
        self.assertEqual(matched[0]['actual_method'], 'complete_hourly_average')

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
