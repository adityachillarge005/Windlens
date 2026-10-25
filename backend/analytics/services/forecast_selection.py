"""
Forecast selection engine for WindLens.
Implements the historical day-ahead procurement decision cutoff logic,
strict look-ahead bias prevention, forecast revision tracking, and outturn matching.
"""

import logging
import math
from datetime import datetime, timezone, time, timedelta, date
from typing import Dict, List, Optional, Tuple, Any
from zoneinfo import ZoneInfo
from .data_processing import parse_iso_timestamp, format_iso_utc, LONDON_TZ, UTC_TZ

logger = logging.getLogger(__name__)

# Default Day-Ahead wholesale procurement decision cutoff assumption:
# 11:00 Europe/London on D-1.
# This is a configurable analytical assumption modeling procurement workflow deadlines.
# Note: This is a configurable analytical assumption, distinct from the BSC Balancing Mechanism Gate Closure
# which occurs 1 hour prior to each half-hour delivery interval.
DEFAULT_CUTOFF_TIME_STR = "11:00"


def compute_day_ahead_cutoff(delivery_dt: datetime, cutoff_time_str: str = DEFAULT_CUTOFF_TIME_STR) -> datetime:
    """
    Calculate the day-ahead procurement decision cutoff datetime for a given delivery datetime.
    
    Rule:
    1. Determine target delivery date D in Europe/London timezone.
    2. Cutoff calendar date is D - 1 day.
    3. Cutoff time is parsed from cutoff_time_str (e.g. '11:00' -> 11:00:00 Europe/London).
    4. Convert cutoff to a timezone-aware UTC datetime.
    
    Eligibility Rule:
    Forecasts published at or before this cutoff (publishTime <= cutoff) are eligible.
    Any forecast published strictly after this cutoff (publishTime > cutoff) is excluded
    to prevent look-ahead bias.
    """
    if delivery_dt.tzinfo is None:
        delivery_dt = delivery_dt.replace(tzinfo=UTC_TZ)

    # Convert delivery datetime to Europe/London to determine the local calendar delivery date
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
    """Selects eligible forecasts based on decision cutoffs and matches to outturn actuals."""

    def __init__(self, cutoff_time_str: str = DEFAULT_CUTOFF_TIME_STR):
        self.cutoff_time_str = cutoff_time_str

    def get_forecasts_for_interval(self, target_iso: str, all_forecasts: List[Dict]) -> List[Dict]:
        """Return all forecast publications for a given target startTime, sorted chronologically."""
        target_dt = parse_iso_timestamp(target_iso)
        if not target_dt:
            return []
        
        target_clean = format_iso_utc(target_dt)
        pubs = [f for f in all_forecasts if f.get('startTime') == target_clean]
        # Sort chronologically by parsed datetime
        pubs.sort(key=lambda x: parse_iso_timestamp(x.get('publishTime')) or datetime.min.replace(tzinfo=UTC_TZ))
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
        - Only publications with parsed publishTime <= cutoff_dt are eligible (inclusive at cutoff).
        - Any publication with publishTime > cutoff_dt is strictly excluded.
        - Missing or invalid publication timestamps are excluded.
        - If no eligible publication exists, returns None.
        """
        if cutoff_dt.tzinfo is None:
            cutoff_dt = cutoff_dt.replace(tzinfo=UTC_TZ)
        else:
            cutoff_dt = cutoff_dt.astimezone(UTC_TZ)

        eligible = []
        for p in publications:
            raw_pub = p.get('publishTime')
            if not raw_pub:
                continue
            pub_dt = parse_iso_timestamp(raw_pub)
            if pub_dt is None:
                continue
            # Ensure timezone awareness
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=UTC_TZ)
            else:
                pub_dt = pub_dt.astimezone(UTC_TZ)

            if pub_dt <= cutoff_dt:
                eligible.append((pub_dt, p))

        if not eligible:
            return None

        # Return the publication with the maximum valid publication datetime
        eligible.sort(key=lambda item: item[0])
        return eligible[-1][1]

    def select_latest_forecast(
        self,
        target_dt: datetime,
        publications: List[Dict]
    ) -> Optional[Dict]:
        """
        Select the latest forecast published prior to delivery (publishTime <= target_dt).
        
        LOOK-AHEAD DEFENSE:
        - Must NEVER return a forecast published after delivery.
        - If no publication exists prior to or at delivery, returns None.
        - No future forecast fallback is permitted.
        """
        if target_dt.tzinfo is None:
            target_dt = target_dt.replace(tzinfo=UTC_TZ)
        else:
            target_dt = target_dt.astimezone(UTC_TZ)

        eligible = []
        for p in publications:
            raw_pub = p.get('publishTime')
            if not raw_pub:
                continue
            pub_dt = parse_iso_timestamp(raw_pub)
            if pub_dt is None:
                continue
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=UTC_TZ)
            else:
                pub_dt = pub_dt.astimezone(UTC_TZ)

            # Strictly require publishTime <= target_dt
            if pub_dt <= target_dt:
                eligible.append((pub_dt, p))

        if not eligible:
            return None

        # Return the most recent publication prior to delivery
        eligible.sort(key=lambda item: item[0])
        return eligible[-1][1]

    def match_forecasts_and_actuals(
        self,
        actuals: List[Dict],
        forecasts: List[Dict],
        cutoff_time_str: Optional[str] = None,
        resolution: str = "exact_hourly"
    ) -> Dict[str, Any]:
        """
        Match actuals and forecasts for all delivery intervals.
        
        Methodology:
        1. Hourly Matching ('exact_hourly' / 'hourly_averaged'):
           - WINDFOR forecasts are published for 1-hour delivery windows (e.g., 12:00:00Z to 13:00:00Z).
           - Elexon FUELHH actuals report average MW for two 30-minute settlement periods in that hour
             (:00:00Z and :30:00Z).
           - To represent the true hourly delivery outturn, the actual generation is computed as the
             arithmetic mean of the two settlement period MW values:
             Actual_hour = (Actual_:00 + Actual_:30) / 2.0  (MW)
           - Interval duration is 1.0 hour.
        
        2. Half-Hourly Matching ('half_hourly_mapped'):
           - Each 30-minute settlement period is evaluated individually (n = 1,488 for January 2026).
           - The prevailing hourly forecast for that hour block is matched to both :00 and :30 actuals.
           - Interval duration is 0.5 hours.
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

        # Index actuals by startTime for O(1) lookups (retain all actual records to accurately audit presence vs invalid values)
        actuals_by_start: Dict[str, Dict] = {}
        for a in actuals:
            st = a.get('startTime')
            if st:
                actuals_by_start[st] = a

        matched_series: List[Dict] = []
        unmatched_count = 0

        if resolution in ("exact_hourly", "hourly_averaged"):
            # Target intervals are hourly (:00:00Z)
            # Find all hourly start timestamps from actuals or forecasts
            hourly_start_keys = sorted(set(
                st for st in list(actuals_by_start.keys()) + list(forecasts_by_target.keys())
                if st.endswith(':00:00Z')
            ))

            for st_iso in hourly_start_keys:
                target_dt = parse_iso_timestamp(st_iso)
                if not target_dt:
                    continue

                # Construct both 30-min settlement period timestamps
                st_00 = st_iso
                st_30_dt = target_dt + timedelta(minutes=30)
                st_30 = format_iso_utc(st_30_dt)

                act_00 = actuals_by_start.get(st_00)
                act_30 = actuals_by_start.get(st_30)

                # STRICT RULE: An hourly actual is considered valid ONLY when BOTH required
                # half-hour readings exist and contain valid numeric generation values.
                # If only one reading exists, or either reading is missing/invalid, mark as incomplete
                # and exclude from matched accuracy metrics.
                act_gen = None
                actual_status = None
                exclusion_reason = None

                if act_00 is None and act_30 is None:
                    actual_status = 'missing_actual'
                    exclusion_reason = 'missing_both_settlement_periods'
                elif act_00 is None:
                    actual_status = 'incomplete_actual'
                    exclusion_reason = 'missing_first_settlement_period'
                elif act_30 is None:
                    actual_status = 'incomplete_actual'
                    exclusion_reason = 'missing_second_settlement_period'
                else:
                    gen_00 = act_00.get('generation')
                    gen_30 = act_30.get('generation')
                    if gen_00 is None or gen_30 is None:
                        actual_status = 'incomplete_actual'
                        exclusion_reason = 'missing_generation_value'
                    else:
                        try:
                            val_00 = float(gen_00)
                            val_30 = float(gen_30)
                            if math.isnan(val_00) or math.isnan(val_30) or math.isinf(val_00) or math.isinf(val_30):
                                actual_status = 'incomplete_actual'
                                exclusion_reason = 'invalid_generation_value'
                            else:
                                act_gen = round((val_00 + val_30) / 2.0, 2)
                                actual_status = 'complete_hourly_average'
                                exclusion_reason = None
                        except (ValueError, TypeError):
                            actual_status = 'incomplete_actual'
                            exclusion_reason = 'invalid_generation_value'

                publications = forecasts_by_target.get(st_iso, [])
                cutoff_dt = compute_day_ahead_cutoff(target_dt, cutoff_str)

                decision_f = self.select_forecast_at_cutoff(target_dt, publications, cutoff_dt)
                latest_f = self.select_latest_forecast(target_dt, publications)

                if decision_f is None or act_gen is None:
                    unmatched_count += 1
                    if decision_f is None and act_gen is None:
                        status_flag = 'missing_both'
                        final_exclusion = f"no_forecast_published_before_cutoff; {exclusion_reason}"
                    elif decision_f is None:
                        status_flag = 'missing_decision_forecast'
                        final_exclusion = 'no_forecast_published_before_cutoff'
                    else:
                        status_flag = 'incomplete_actual'
                        final_exclusion = exclusion_reason

                    matched_series.append({
                        'startTime': st_iso,
                        'settlementDate': act_00.get('settlementDate') if act_00 else (act_30.get('settlementDate') if act_30 else None),
                        'settlementPeriod': act_00.get('settlementPeriod') if act_00 else None,
                        'actual': None,  # Strictly None when incomplete to prevent accidental usage
                        'actual_method': actual_status,
                        'exclusion_reason': final_exclusion,
                        'decision_forecast': None,
                        'decision_publish_time': decision_f.get('publishTime') if decision_f else None,
                        'latest_forecast': latest_f.get('generation') if latest_f else None,
                        'latest_publish_time': latest_f.get('publishTime') if latest_f else None,
                        'cutoff_timestamp': format_iso_utc(cutoff_dt),
                        'interval_duration_hours': 1.0,
                        'error': None,
                        'abs_error': None,
                        'status': status_flag,
                    })
                else:
                    f_val = float(decision_f.get('generation'))
                    err = round(f_val - act_gen, 2)
                    abs_err = round(abs(err), 2)

                    matched_series.append({
                        'startTime': st_iso,
                        'settlementDate': act_00.get('settlementDate') if act_00 else None,
                        'settlementPeriod': act_00.get('settlementPeriod') if act_00 else None,
                        'actual': act_gen,
                        'actual_method': actual_status,
                        'exclusion_reason': None,
                        'decision_forecast': f_val,
                        'decision_publish_time': decision_f.get('publishTime'),
                        'latest_forecast': latest_f.get('generation') if latest_f else None,
                        'latest_publish_time': latest_f.get('publishTime') if latest_f else None,
                        'cutoff_timestamp': format_iso_utc(cutoff_dt),
                        'interval_duration_hours': 1.0,
                        'error': err,
                        'abs_error': abs_err,
                        'status': 'matched',
                    })

        else:
            # Half-hourly resolution ('half_hourly_mapped')
            # Evaluate every 30-minute settlement period
            half_hour_keys = sorted(actuals_by_start.keys())

            for st_iso in half_hour_keys:
                act = actuals_by_start[st_iso]
                act_gen = act.get('generation')
                target_dt = parse_iso_timestamp(st_iso)
                if not target_dt or act_gen is None:
                    continue

                # Map 30-min interval to the parent hour's forecast
                hour_dt = target_dt.replace(minute=0, second=0, microsecond=0)
                hour_iso = format_iso_utc(hour_dt)

                publications = forecasts_by_target.get(hour_iso, [])
                cutoff_dt = compute_day_ahead_cutoff(target_dt, cutoff_str)

                decision_f = self.select_forecast_at_cutoff(target_dt, publications, cutoff_dt)
                latest_f = self.select_latest_forecast(target_dt, publications)

                if decision_f is None:
                    unmatched_count += 1
                    matched_series.append({
                        'startTime': st_iso,
                        'settlementDate': act.get('settlementDate'),
                        'settlementPeriod': act.get('settlementPeriod'),
                        'actual': act_gen,
                        'actual_method': 'settlement_period_half_hour',
                        'decision_forecast': None,
                        'decision_publish_time': None,
                        'latest_forecast': latest_f.get('generation') if latest_f else None,
                        'latest_publish_time': latest_f.get('publishTime') if latest_f else None,
                        'cutoff_timestamp': format_iso_utc(cutoff_dt),
                        'interval_duration_hours': 0.5,
                        'error': None,
                        'abs_error': None,
                        'status': 'missing_decision_forecast',
                    })
                else:
                    f_val = float(decision_f.get('generation'))
                    err = round(f_val - act_gen, 2)
                    abs_err = round(abs(err), 2)

                    matched_series.append({
                        'startTime': st_iso,
                        'settlementDate': act.get('settlementDate'),
                        'settlementPeriod': act.get('settlementPeriod'),
                        'actual': act_gen,
                        'actual_method': 'settlement_period_half_hour',
                        'decision_forecast': f_val,
                        'decision_publish_time': decision_f.get('publishTime'),
                        'latest_forecast': latest_f.get('generation') if latest_f else None,
                        'latest_publish_time': latest_f.get('publishTime') if latest_f else None,
                        'cutoff_timestamp': format_iso_utc(cutoff_dt),
                        'interval_duration_hours': 0.5,
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
            pub_dt = parse_iso_timestamp(p.get('publishTime'))
            if pub_dt:
                pub_utc = pub_dt.astimezone(UTC_TZ)
                target_utc = target_dt.astimezone(UTC_TZ)
                lead_hours = round((target_utc - pub_utc).total_seconds() / 3600.0, 1)
                is_before_cutoff = (pub_utc <= cutoff_dt)
            else:
                lead_hours = None
                is_before_cutoff = False

            gen_val = p.get('generation', 0)
            delta = round(gen_val - prev_gen, 2) if prev_gen is not None else 0.0

            is_active_at_cutoff = (p.get('publishTime') == decision_selected_pub_time)

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
            'cutoff_time_rule': f"{cutoff_str} Europe/London on D-1 (Wholesale Day-Ahead Decision Cutoff)",
            'total_publications': len(enhanced_pubs),
            'selected_decision_forecast': decision_selected,
            'publications': enhanced_pubs,
        }
