"""
Unit tests for DataProcessor and timestamp normalization.
SYNTHETIC TEST FIXTURES: All fixtures in this file are synthetically generated.
"""

from datetime import datetime, timezone
import unittest
from analytics.services.data_processing import (
    DataProcessor,
    parse_iso_timestamp,
    format_iso_utc,
    LONDON_TZ,
    UTC_TZ,
)


class TestDataProcessing(unittest.TestCase):
    """Test suite for timestamp normalization and data cleaning."""

    def test_parse_iso_timestamp_various_formats(self):
        """Synthetic test: Parse ISO strings with 'Z' and timezone offsets."""
        dt_z = parse_iso_timestamp("2026-01-01T12:00:00Z")
        self.assertEqual(dt_z.year, 2026)
        self.assertEqual(dt_z.hour, 12)
        self.assertEqual(dt_z.tzinfo, UTC_TZ)

        dt_offset = parse_iso_timestamp("2026-01-01T13:00:00+01:00")
        self.assertEqual(dt_offset.hour, 12) # Converted to UTC
        self.assertEqual(dt_offset.tzinfo, UTC_TZ)

        self.assertIsNone(parse_iso_timestamp("invalid-date-format"))
        self.assertIsNone(parse_iso_timestamp(None))

    def test_clean_actuals_filters_wind_and_deduplicates(self):
        """Synthetic test: Retain only WIND, clamp small negatives, deduplicate."""
        processor = DataProcessor()
        synthetic_fuelhh = [
            # Biomass record: must be excluded
            {'fuelType': 'BIOMASS', 'startTime': '2026-01-01T00:00:00Z', 'generation': 1500},
            # Wind record 1
            {'fuelType': 'WIND', 'startTime': '2026-01-01T00:00:00Z', 'generation': 12000, 'publishTime': '2026-01-01T00:30:00Z'},
            # Duplicate Wind record 1 with later publishTime: should replace earlier
            {'fuelType': 'WIND', 'startTime': '2026-01-01T00:00:00Z', 'generation': 12050, 'publishTime': '2026-01-01T00:35:00Z'},
            # Wind record with minor negative sensor noise (-1 MW): should clamp to 0
            {'fuelType': 'WIND', 'startTime': '2026-01-01T00:30:00Z', 'generation': -1.0, 'publishTime': '2026-01-01T01:00:00Z'},
            # Wind record with large invalid negative (-50 MW): should skip
            {'fuelType': 'WIND', 'startTime': '2026-01-01T01:00:00Z', 'generation': -50.0, 'publishTime': '2026-01-01T01:30:00Z'},
        ]

        cleaned = processor.clean_actuals(synthetic_fuelhh)
        self.assertEqual(len(cleaned), 2)
        # Check deduplication
        self.assertEqual(cleaned[0]['startTime'], '2026-01-01T00:00:00Z')
        self.assertEqual(cleaned[0]['generation'], 12050.0)
        # Check clamping
        self.assertEqual(cleaned[1]['startTime'], '2026-01-01T00:30:00Z')
        self.assertEqual(cleaned[1]['generation'], 0.0)

    def test_clean_forecasts_deduplicates(self):
        """Synthetic test: Deduplicate identical (startTime, publishTime) pairs."""
        processor = DataProcessor()
        synthetic_forecasts = [
            {'startTime': '2026-01-01T12:00:00Z', 'publishTime': '2025-12-31T09:00:00Z', 'generation': 5000.0},
            {'startTime': '2026-01-01T12:00:00Z', 'publishTime': '2025-12-31T09:00:00Z', 'generation': 5000.0},
            {'startTime': '2026-01-01T12:00:00Z', 'publishTime': '2025-12-31T11:00:00Z', 'generation': 5200.0},
        ]

        cleaned = processor.clean_forecasts(synthetic_forecasts)
        self.assertEqual(len(cleaned), 2)

    def test_completeness_audit(self):
        """Synthetic test: Completeness checks 1488 expected half-hours and 744 expected hours."""
        processor = DataProcessor()
        # Create minimal synthetic list
        synthetic_actuals = [{'startTime': '2026-01-01T00:00:00Z', 'generation': 100.0}]
        synthetic_forecasts = [{'startTime': '2026-01-01T00:00:00Z', 'publishTime': '2025-12-31T10:00:00Z', 'generation': 100.0}]

        audit = processor.compute_completeness_audit(synthetic_actuals, synthetic_forecasts)
        self.assertEqual(audit['expected_half_hour_intervals'], 1488)
        self.assertEqual(audit['expected_hour_intervals'], 744)
        self.assertEqual(audit['actual_intervals_found'], 1)
        self.assertEqual(audit['missing_actual_intervals_count'], 1487)
