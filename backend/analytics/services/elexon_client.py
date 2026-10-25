"""
Elexon BMRS API client for retrieving UK national wind actuals (FUELHH) and forecasts (WINDFOR).
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class ElexonAPIError(Exception):
    """Custom exception raised for Elexon API communication failures."""
    pass


class ElexonClient:
    """Client for Elexon BMRS Open API v1 stream endpoints."""

    def __init__(self, base_url: Optional[str] = None, timeout: int = 30, max_retries: int = 3):
        self.base_url = (base_url or getattr(settings, 'ELEXON_BASE_URL', 'https://data.elexon.co.uk/bmrs/api/v1')).rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'WindLens-Analytics/1.0',
            'Accept': 'application/json',
        })

    def fetch_stream(self, dataset: str, date_from: str, date_to: str) -> List[Dict]:
        """
        Fetch records from a BMRS dataset stream endpoint.
        Uses publishDateTimeFrom and publishDateTimeTo parameters.
        Includes retry logic with exponential backoff.
        """
        url = f"{self.base_url}/datasets/{dataset}/stream"
        params = {
            'publishDateTimeFrom': date_from,
            'publishDateTimeTo': date_to,
        }

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"Fetching {dataset} stream from {date_from} to {date_to} (attempt {attempt}/{self.max_retries})")
                response = self.session.get(url, params=params, timeout=self.timeout)

                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        logger.info(f"Successfully retrieved {len(data)} {dataset} records")
                        return data
                    elif isinstance(data, dict) and 'data' in data:
                        logger.info(f"Successfully retrieved {len(data['data'])} {dataset} records")
                        return data['data']
                    else:
                        logger.warning(f"Unexpected JSON format for {dataset}: {type(data)}")
                        return []
                elif response.status_code == 404:
                    logger.warning(f"No records found (404) for {dataset} between {date_from} and {date_to}")
                    return []
                else:
                    logger.warning(f"Elexon API returned status {response.status_code}: {response.text[:200]}")
                    last_error = ElexonAPIError(f"HTTP {response.status_code}: {response.text[:200]}")
            except (requests.RequestException, ValueError) as exc:
                logger.warning(f"Request error on attempt {attempt}: {exc}")
                last_error = exc

            if attempt < self.max_retries:
                sleep_sec = 1.5 ** attempt
                time.sleep(sleep_sec)

        raise ElexonAPIError(f"Failed to fetch {dataset} after {self.max_retries} attempts: {last_error}")

    def fetch_fuelhh_wind_chunked(self, start_dt: datetime, end_dt: datetime, chunk_days: int = 7) -> List[Dict]:
        """
        Fetch FUELHH half-hourly actuals over a date range, split into safe chunks,
        and filter exclusively for fuelType == 'WIND'.
        """
        records: List[Dict] = []
        curr = start_dt
        while curr < end_dt:
            nxt = min(curr + timedelta(days=chunk_days), end_dt)
            chunk_from = curr.strftime('%Y-%m-%dT%H:%M:%SZ')
            chunk_to = nxt.strftime('%Y-%m-%dT%H:%M:%SZ')

            chunk_data = self.fetch_stream('FUELHH', chunk_from, chunk_to)
            # Retain only fuelType == 'WIND'
            wind_records = [
                r for r in chunk_data
                if r.get('fuelType') == 'WIND' and 'startTime' in r and 'generation' in r
            ]
            records.extend(wind_records)
            curr = nxt

        logger.info(f"Total WIND actuals retrieved: {len(records)}")
        return records

    def fetch_windfor_chunked(self, start_dt: datetime, end_dt: datetime, chunk_days: int = 7) -> List[Dict]:
        """
        Fetch WINDFOR forecast publications over a date range, split into safe chunks.
        """
        records: List[Dict] = []
        curr = start_dt
        while curr < end_dt:
            nxt = min(curr + timedelta(days=chunk_days), end_dt)
            chunk_from = curr.strftime('%Y-%m-%dT%H:%M:%SZ')
            chunk_to = nxt.strftime('%Y-%m-%dT%H:%M:%SZ')

            chunk_data = self.fetch_stream('WINDFOR', chunk_from, chunk_to)
            valid_forecasts = [
                r for r in chunk_data
                if 'startTime' in r and 'publishTime' in r and 'generation' in r
            ]
            records.extend(valid_forecasts)
            curr = nxt

        logger.info(f"Total WINDFOR forecasts retrieved: {len(records)}")
        return records
