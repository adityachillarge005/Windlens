"""
Data processing and normalization service for WindLens.
Handles timezone normalization (Europe/London & UTC), data cleaning,
deduplication, local caching, and dataset completeness auditing.
"""

import json
import logging
from datetime import datetime, timezone, time, date, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from zoneinfo import ZoneInfo
from django.conf import settings
from .elexon_client import ElexonClient, ElexonAPIError

logger = logging.getLogger(__name__)

LONDON_TZ = ZoneInfo("Europe/London")
UTC_TZ = timezone.utc


def parse_iso_timestamp(ts: Any) -> Optional[datetime]:
    """
    Parse an ISO timestamp string into a timezone-aware UTC datetime.
    Supports standard ISO formats with 'Z' or timezone offsets.
    """
    if ts is None:
        return None
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            return ts.replace(tzinfo=UTC_TZ)
        return ts.astimezone(UTC_TZ)
    if not isinstance(ts, str):
        return None

    try:
        clean_str = ts.strip().replace('Z', '+00:00')
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC_TZ)
        return dt.astimezone(UTC_TZ)
    except (ValueError, TypeError) as exc:
        logger.warning(f"Failed to parse timestamp '{ts}': {exc}")
        return None


def format_iso_utc(dt: datetime) -> str:
    """Format a datetime to canonical ISO 8601 UTC string: YYYY-MM-DDTHH:MM:SSZ."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC_TZ)
    else:
        dt = dt.astimezone(UTC_TZ)
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


class DataProcessor:
    """Manages cleaning, caching, and completeness checks for energy data."""

    def __init__(self, cache_dir: Optional[Path] = None):
        self.cache_dir = cache_dir or getattr(settings, 'DATA_CACHE_DIR', Path('data_cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.client = ElexonClient()

    def clean_actuals(self, raw_records: List[Dict]) -> List[Dict]:
        """
        Clean, normalize, and deduplicate actual wind generation records (FUELHH).
        Retains fuelType == 'WIND', parses startTime and publishTime,
        validates generation MW, and deduplicates by target startTime.
        """
        seen_starts = {}
        for r in raw_records:
            if r.get('fuelType') != 'WIND':
                continue
            
            st = parse_iso_timestamp(r.get('startTime'))
            if st is None:
                continue

            gen = r.get('generation')
            try:
                gen_val = float(gen) if gen is not None else None
            except (ValueError, TypeError):
                gen_val = None

            if gen_val is None or gen_val < 0:
                # If negative generation is recorded due to sensor anomaly, clamp or skip
                # In UK wind, negative generation sometimes appears as tiny metering error;
                # Treat small negatives (< 0 and >= -5) as 0, otherwise skip invalid
                if gen_val is not None and gen_val >= -5.0:
                    gen_val = 0.0
                else:
                    continue

            pub = parse_iso_timestamp(r.get('publishTime'))
            clean_item = {
                'startTime': format_iso_utc(st),
                'publishTime': format_iso_utc(pub) if pub else None,
                'generation': round(gen_val, 2),
                'settlementDate': r.get('settlementDate'),
                'settlementPeriod': r.get('settlementPeriod'),
            }

            st_key = clean_item['startTime']
            # Deduplicate by startTime: keep the one with latest publication or valid data
            if st_key not in seen_starts:
                seen_starts[st_key] = clean_item
            else:
                existing_pub = seen_starts[st_key].get('publishTime')
                if clean_item['publishTime'] and (not existing_pub or clean_item['publishTime'] > existing_pub):
                    seen_starts[st_key] = clean_item

        cleaned = sorted(seen_starts.values(), key=lambda x: x['startTime'])
        return cleaned

    def clean_forecasts(self, raw_records: List[Dict]) -> List[Dict]:
        """
        Clean, normalize, and deduplicate wind forecast records (WINDFOR).
        Parses startTime and publishTime, validates generation MW,
        and deduplicates exact (startTime, publishTime) duplicates.
        """
        seen = {}
        for r in raw_records:
            st = parse_iso_timestamp(r.get('startTime'))
            pub = parse_iso_timestamp(r.get('publishTime'))
            if st is None or pub is None:
                continue

            gen = r.get('generation')
            try:
                gen_val = float(gen) if gen is not None else None
            except (ValueError, TypeError):
                gen_val = None

            if gen_val is None or gen_val < 0:
                continue

            st_iso = format_iso_utc(st)
            pub_iso = format_iso_utc(pub)
            key = (st_iso, pub_iso)

            clean_item = {
                'startTime': st_iso,
                'publishTime': pub_iso,
                'generation': round(gen_val, 2),
            }
            seen[key] = clean_item

        cleaned = sorted(seen.values(), key=lambda x: (x['startTime'], x['publishTime']))
        return cleaned

    def get_january_2026_data(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Load or retrieve January 2026 data.
        Returns a dict containing:
        - 'actuals': list of cleaned FUELHH WIND records
        - 'forecasts': list of cleaned WINDFOR records
        - 'metadata': retrieval info, timestamp, record counts
        """
        cache_file = self.cache_dir / "january_2026_dataset.json"

        if not force_refresh and cache_file.exists():
            try:
                logger.info(f"Loading January 2026 dataset from cache: {cache_file}")
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data
            except Exception as exc:
                logger.warning(f"Failed to read cache file {cache_file}: {exc}. Re-fetching.")

        logger.info("Fetching January 2026 dataset from Elexon BMRS API...")
        # To cover all Day-Ahead decision cutoffs for Jan 1, we must fetch forecasts published
        # starting from Dec 30, 2025 through Feb 1, 2026.
        fetch_start = datetime(2025, 12, 30, 0, 0, 0, tzinfo=UTC_TZ)
        fetch_end = datetime(2026, 2, 1, 23, 59, 59, tzinfo=UTC_TZ)

        raw_actuals = self.client.fetch_fuelhh_wind_chunked(fetch_start, fetch_end, chunk_days=8)
        raw_forecasts = self.client.fetch_windfor_chunked(fetch_start, fetch_end, chunk_days=8)

        cleaned_actuals = self.clean_actuals(raw_actuals)
        cleaned_forecasts = self.clean_forecasts(raw_forecasts)

        metadata = {
            'retrieved_at': format_iso_utc(datetime.now(timezone.utc)),
            'target_period': '2026-01-01 to 2026-01-31',
            'actuals_count': len(cleaned_actuals),
            'forecasts_count': len(cleaned_forecasts),
            'source_actuals': 'Elexon BMRS FUELHH (fuelType=WIND)',
            'source_forecasts': 'Elexon BMRS WINDFOR',
            'timezone': 'Europe/London (GMT/BST aware, normalized to UTC)',
        }

        dataset = {
            'metadata': metadata,
            'actuals': cleaned_actuals,
            'forecasts': cleaned_forecasts,
        }

        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(dataset, f)
            logger.info(f"Cached January 2026 dataset to {cache_file}")
        except Exception as exc:
            logger.warning(f"Could not write cache file: {exc}")

        return dataset

    def compute_completeness_audit(self, actuals: List[Dict], forecasts: List[Dict]) -> Dict[str, Any]:
        """
        Audit January 2026 interval completeness.
        Expected half-hour intervals: 31 days * 48 = 1,488.
        Expected hourly intervals: 31 days * 24 = 744.
        """
        # January 2026 expected intervals
        start_jan = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC_TZ)
        end_jan = datetime(2026, 1, 31, 23, 30, 0, tzinfo=UTC_TZ)

        expected_half_hours = []
        curr = start_jan
        while curr <= end_jan:
            expected_half_hours.append(format_iso_utc(curr))
            curr += timedelta(minutes=30)

        expected_hours = [ts for ts in expected_half_hours if ts.endswith(':00:00Z')]

        actuals_dict = {a['startTime']: a for a in actuals}
        actual_jan_half_hours = [ts for ts in expected_half_hours if ts in actuals_dict]
        missing_actual_half_hours = [ts for ts in expected_half_hours if ts not in actuals_dict]

        # Forecast intervals for January
        forecast_starts = set(f['startTime'] for f in forecasts)
        forecast_jan_hours = [ts for ts in expected_hours if ts in forecast_starts]
        missing_forecast_hours = [ts for ts in expected_hours if ts not in forecast_starts]

        return {
            'expected_half_hour_intervals': len(expected_half_hours),  # 1488
            'expected_hour_intervals': len(expected_hours),            # 744
            'actual_intervals_found': len(actual_jan_half_hours),
            'actual_coverage_percent': round((len(actual_jan_half_hours) / len(expected_half_hours)) * 100, 2),
            'missing_actual_intervals_count': len(missing_actual_half_hours),
            'forecast_hour_intervals_found': len(forecast_jan_hours),
            'forecast_hour_coverage_percent': round((len(forecast_jan_hours) / len(expected_hours)) * 100, 2),
            'missing_forecast_hours_count': len(missing_forecast_hours),
            'sample_missing_actuals': missing_actual_half_hours[:5],
            'sample_missing_forecasts': missing_forecast_hours[:5],
        }
