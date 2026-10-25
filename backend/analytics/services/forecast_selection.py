"""
Forecast selection engine for WindLens.
Implements the historical day-ahead procurement decision cutoff logic,
look-ahead bias prevention, forecast revision tracking, and forecast/actual matching.
"""

import logging
from datetime import datetime, timezone, time, timedelta, date
from typing import Dict, List, Optional, Tuple, Any
from zoneinfo import ZoneInfo
from .data_processing import parse_iso_timestamp, format_iso_utc, LONDON_TZ, UTC_TZ

logger = logging.getLogger(__name__)

# Default Day-Ahead auction gate closure assumption in the UK wholesale market:
# 11:00 Europe/London on D-1 (EPEX SPOT GB Day-Ahead auction gate closure).
DEFAULT_CUTOFF_TIME_STR = "11:00"


def compute_day_ahead_cutoff(delivery_dt: datetime, cutoff_time_str: str = DEFAULT_CUTOFF_TIME_STR) -> datetime:
    """
    Calculate the day-ahead procurement decision cutoff for a given delivery datetime.
    
    Rule:
    1. Determine delivery date D in Europe/London timezone.
    2. Cutoff date is D - 1 day.
    3. Cutoff time is parsed from cutoff_time_str (e.g. '11:00' -> 11:00:00 Europe/London).
    4. Convert cutoff to UTC datetime.
    
    Example:
    Delivery: 2026-01-05 14:00:00 UTC -> Delivery Day in London: 2026-01-05
    Cutoff Date: 2026-01-04
    Cutoff in London: 2026-01-04 11:00:00 Europe/London
    Cutoff in UTC: 2026-01-04 11:00:00 UTC (January is GMT, UTC+0)
    """
    if delivery_dt.tzinfo is None:
        delivery_dt = delivery_dt.replace(tzinfo=UTC_TZ)

    # Convert delivery datetime to Europe/London to get local calendar date
    london_delivery = delivery_dt.astimezone(LONDON_TZ)
    delivery_date = london_delivery.date()
    cutoff_date = delivery_date - timedelta(days=1)

    try:
        parts = cutoff_time_str.strip().split(':')
        cutoff_hour = int(parts[0])
        cutoff_minute = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        cutoff_hour, cutoff_minute = 11, 0

    cutoff_local = datetime(
        cutoff_date.year,
        cutoff_date.month,
        cutoff_date.day,
        cutoff_hour,
        cutoff_minute,
        0,
        tzinfo=LONDON_TZ
    )
    return cutoff_local.astimezone(UTC_TZ)


class ForecastSelector:
    """Selects eligible forecasts based on decision cutoffs and matches to actuals."""

    def __init__(self, cutoff_time_str: str = DEFAULT_CUTOFF_TIME_STR):
        self.cutoff_time_str = cutoff_time_str

    def get_forecasts_for_interval(self, target_iso: str, all_forecasts: List[Dict]) -> List[Dict]:
        """Return all forecast publications for a given target startTime, sorted chronologically."""
        target_dt = parse_iso_timestamp(target_iso)
        if not target_dt:
            return []
        
        target_clean = format_iso_utc(target_dt)
        pubs = [f for f in all_forecasts if f.get('startTime') == target_clean]
        pubs.sort(key=lambda x: x['publishTime'])
        return pubs

    def select_forecast_at_cutoff(
        self,
        target_dt: datetime,
        publications: List[Dict],
        cutoff_dt: datetime
    ) -> Optional[Dict]:
        """
        Select the latest forecast published at or before the decision cutoff.
        STRICT LOOK-AHEAD BIAS PREVENTION:
        Only publications with publishTime <= cutoff_dt are eligible.
        Returns the publication with the maximum publishTime among eligible, or None.
        """
        cutoff_iso = format_iso_utc(cutoff_dt)
        eligible = [
            p for p in publications
            if p.get('publishTime') and p['publishTime'] <= cutoff_iso
        ]
        if not eligible:
            return None

        # Return the most recent eligible publication
        return max(eligible, key=lambda x: x['publishTime'])

    def select_latest_forecast(
        self,
        target_dt: datetime,
        publications: List[Dict]
    ) -> Optional[Dict]:
        """
        Select the latest currently available forecast for the interval,
        published prior to delivery (publishTime <= target_dt) or overall latest.
        """
        target_iso = format_iso_utc(target_dt)
        # In wholesale trading, latest available before delivery is the final gate forecast
        eligible = [p for p in publications if p.get('publishTime') and p['publishTime'] <= target_iso]
        if eligible:
            return max(eligible, key=lambda x: x['publishTime'])
        if publications:
            return max(publications, key=lambda x: x['publishTime'])
        return None

    def match_forecasts_and_actuals(
        self,
        actuals: List[Dict],
        forecasts: List[Dict],
        cutoff_time_str: Optional[str] = None,
        resolution: str = "exact_hourly"
    ) -> Dict[str, Any]:
        """
        Match actuals and forecasts for all delivery intervals.
        
        Parameters:
        - actuals: List of FUELHH actual records (WIND)
        - forecasts: List of WINDFOR forecast records
        - cutoff_time_str: Day-ahead cutoff time (e.g. '11:00')
        - resolution: 'exact_hourly' (default, matches :00 to :00) or
                      'half_hourly_mapped' (maps hourly forecast to both :00 and :30)
                      
        Returns a dictionary with:
        - 'matched_series': List of matched interval objects
        - 'cutoff_time_applied': Cutoff time string used
        - 'total_actual_intervals': Total actual records evaluated
        - 'matched_intervals_count': Number of successfully matched intervals
        - 'unmatched_intervals_count': Number of actual intervals with no eligible forecast
        """
        cutoff_str = cutoff_time_str or self.cutoff_time_str
        
        # Index forecasts by target startTime for O(1) lookups
        forecasts_by_target: Dict[str, List[Dict]] = {}
        for f in forecasts:
            st = f.get('startTime')
            if st:
                if st not in forecasts_by_target:
                    forecasts_by_target[st] = []
                forecasts_by_target[st].append(f)

        matched_series: List[Dict] = []
        unmatched_count = 0

        for act in actuals:
            st_iso = act.get('startTime')
            act_gen = act.get('generation')
            if not st_iso or act_gen is None:
                continue

            target_dt = parse_iso_timestamp(st_iso)
            if not target_dt:
                continue

            # Determine matching forecast key depending on resolution
            if resolution == "half_hourly_mapped":
                # For XX:30:00, map to the hourly forecast at XX:00:00
                forecast_key_dt = target_dt.replace(minute=0, second=0, microsecond=0)
                forecast_key = format_iso_utc(forecast_key_dt)
            else:
                # exact_hourly: only evaluate intervals that start at :00:00
                if target_dt.minute != 0:
                    continue
                forecast_key = st_iso

            publications = forecasts_by_target.get(forecast_key, [])
            cutoff_dt = compute_day_ahead_cutoff(target_dt, cutoff_str)

            decision_f = self.select_forecast_at_cutoff(target_dt, publications, cutoff_dt)
            latest_f = self.select_latest_forecast(target_dt, publications)

            if decision_f is None:
                unmatched_count += 1
                # Still include or record that decision forecast is unavailable
                matched_series.append({
                    'startTime': st_iso,
                    'settlementDate': act.get('settlementDate'),
                    'settlementPeriod': act.get('settlementPeriod'),
                    'actual': act_gen,
                    'decision_forecast': None,
                    'decision_publish_time': None,
                    'latest_forecast': latest_f.get('generation') if latest_f else None,
                    'latest_publish_time': latest_f.get('publishTime') if latest_f else None,
                    'cutoff_timestamp': format_iso_utc(cutoff_dt),
                    'error': None,
                    'abs_error': None,
                    'status': 'missing_decision_forecast',
                })
            else:
                f_val = decision_f.get('generation')
                err = round(f_val - act_gen, 2)
                abs_err = round(abs(err), 2)

                matched_series.append({
                    'startTime': st_iso,
                    'settlementDate': act.get('settlementDate'),
                    'settlementPeriod': act.get('settlementPeriod'),
                    'actual': act_gen,
                    'decision_forecast': f_val,
                    'decision_publish_time': decision_f.get('publishTime'),
                    'latest_forecast': latest_f.get('generation') if latest_f else None,
                    'latest_publish_time': latest_f.get('publishTime') if latest_f else None,
                    'cutoff_timestamp': format_iso_utc(cutoff_dt),
                    'error': err,
                    'abs_error': abs_err,
                    'status': 'matched',
                })

        valid_matched = [m for m in matched_series if m['status'] == 'matched']
        return {
            'matched_series': matched_series,
            'valid_matched_count': len(valid_matched),
            'unmatched_count': unmatched_count,
            'cutoff_time_applied': cutoff_str,
            'resolution': resolution,
        }

    def inspect_interval_revisions(
        self,
        target_iso: str,
        all_forecasts: List[Dict],
        cutoff_time_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Inspect the full revision history for a single delivery interval.
        Shows how the prediction evolved leading up to delivery,
        highlighting the one active at the decision cutoff and separating post-cutoff publications.
        """
        target_dt = parse_iso_timestamp(target_iso)
        if not target_dt:
            return {'error': f"Invalid target timestamp: {target_iso}"}

        cutoff_str = cutoff_time_str or self.cutoff_time_str
        cutoff_dt = compute_day_ahead_cutoff(target_dt, cutoff_str)
        cutoff_iso = format_iso_utc(cutoff_dt)

        pubs = self.get_forecasts_for_interval(target_iso, all_forecasts)
        if not pubs:
            return {
                'target_time': target_iso,
                'cutoff_time': cutoff_iso,
                'publications': [],
                'selected_decision_forecast': None,
                'message': 'No forecast publications found for this delivery interval.'
            }

        decision_selected = self.select_forecast_at_cutoff(target_dt, pubs, cutoff_dt)
        decision_selected_pub_time = decision_selected.get('publishTime') if decision_selected else None

        enhanced_pubs = []
        prev_gen = None
        for p in pubs:
            pub_dt = parse_iso_timestamp(p['publishTime'])
            lead_hours = round((target_dt - pub_dt).total_seconds() / 3600.0, 1) if pub_dt else None
            gen_val = p.get('generation', 0)
            delta = round(gen_val - prev_gen, 2) if prev_gen is not None else 0.0

            is_active_at_cutoff = (p.get('publishTime') == decision_selected_pub_time)
            is_before_cutoff = bool(p.get('publishTime') and p['publishTime'] <= cutoff_iso)

            enhanced_pubs.append({
                'publishTime': p.get('publishTime'),
                'generation': gen_val,
                'lead_hours_before_delivery': lead_hours,
                'revision_delta_mw': delta,
                'is_eligible_at_cutoff': is_before_cutoff,
                'is_selected_decision_forecast': is_active_at_cutoff,
                'category': 'decision_eligible' if is_before_cutoff else 'post_cutoff_intraday',
            })
            prev_gen = gen_val

        return {
            'target_time': target_iso,
            'cutoff_time': cutoff_iso,
            'cutoff_time_rule': f"{cutoff_str} Europe/London on D-1",
            'total_publications': len(enhanced_pubs),
            'selected_decision_forecast': decision_selected,
            'publications': enhanced_pubs,
        }
