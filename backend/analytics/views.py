"""
REST API views for WindLens.
Provides endpoints for health checks, latest forecasts, accuracy summaries,
time-series accuracy matching, forecast revision history, and data quality audits.
"""

import logging
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .services.data_processing import DataProcessor, parse_iso_timestamp, format_iso_utc
from .services.forecast_selection import ForecastSelector
from .services.accuracy_metrics import AccuracyCalculator
from .serializers import QueryParamsSerializer, HistoryQuerySerializer

logger = logging.getLogger(__name__)


class BaseAnalyticsView(APIView):
    """Base class providing shared data loading and filtering utilities."""

    def get_data(self, force_refresh: bool = False):
        processor = DataProcessor()
        return processor.get_january_2026_data(force_refresh=force_refresh)

    def filter_by_date_range(self, series: list, start_date_str: str, end_date_str: str) -> list:
        """Filter a list of items having a 'startTime' attribute to the requested date range."""
        if not start_date_str and not end_date_str:
            return series

        filtered = []
        for item in series:
            st = item.get('startTime')
            if not st:
                continue
            item_date = st[:10]  # YYYY-MM-DD
            if start_date_str and item_date < start_date_str:
                continue
            if end_date_str and item_date > end_date_str:
                continue
            filtered.append(item)
        return filtered


class HealthView(APIView):
    """GET /api/health/ - Application and data pipeline health check."""

    def get(self, request):
        processor = DataProcessor()
        cache_file = processor.cache_dir / "january_2026_dataset.json"
        is_cached = cache_file.exists()
        last_retrieval = None
        actuals_cnt = 0
        forecasts_cnt = 0

        if is_cached:
            try:
                data = processor.get_january_2026_data(force_refresh=False)
                meta = data.get('metadata', {})
                last_retrieval = meta.get('retrieved_at')
                actuals_cnt = meta.get('actuals_count', len(data.get('actuals', [])))
                forecasts_cnt = meta.get('forecasts_count', len(data.get('forecasts', [])))
            except Exception as e:
                logger.error(f"Health check error reading cache: {e}")

        return Response({
            'status': 'healthy',
            'app': 'WindLens',
            'version': '1.0.0',
            'dataset': 'UK National Wind Generation (January 2026)',
            'data_cached': is_cached,
            'last_retrieval': last_retrieval,
            'actuals_count': actuals_cnt,
            'forecasts_count': forecasts_cnt,
            'source_actuals': 'https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream',
            'source_forecasts': 'https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream',
        })


class ForecastLatestView(BaseAnalyticsView):
    """GET /api/forecast/latest/ - Latest available forecasts and decision-time forecasts."""

    def get(self, request):
        query_serializer = QueryParamsSerializer(data=request.query_params)
        if not query_serializer.is_valid():
            return Response({'error': 'Invalid query parameters', 'details': query_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        params = query_serializer.validated_data
        start_date = params.get('start_date', '2026-01-01')
        end_date = params.get('end_date', '2026-01-31')
        cutoff_time = params.get('cutoff_time', '11:00')
        resolution = params.get('resolution', 'exact_hourly')
        force_refresh = params.get('force_refresh', False)

        dataset = self.get_data(force_refresh=force_refresh)
        actuals = dataset.get('actuals', [])
        forecasts = dataset.get('forecasts', [])

        selector = ForecastSelector(cutoff_time_str=cutoff_time)
        match_result = selector.match_forecasts_and_actuals(
            actuals=actuals,
            forecasts=forecasts,
            cutoff_time_str=cutoff_time,
            resolution=resolution
        )

        filtered_series = self.filter_by_date_range(match_result['matched_series'], start_date, end_date)

        # Extract latest eligible publication timestamp across the series
        eligible_pubs = [m['decision_publish_time'] for m in filtered_series if m.get('decision_publish_time')]
        latest_eligible_pub = max(eligible_pubs) if eligible_pubs else None

        return Response({
            'period': {'start_date': start_date, 'end_date': end_date},
            'cutoff_time_applied': cutoff_time,
            'resolution': resolution,
            'latest_eligible_publication': latest_eligible_pub,
            'total_intervals': len(filtered_series),
            'matched_intervals': len([m for m in filtered_series if m.get('status') == 'matched']),
            'series': filtered_series,
        })


class AccuracySummaryView(BaseAnalyticsView):
    """GET /api/accuracy/summary/ - Summary accuracy KPIs (MAE, RMSE, Bias, WAPE)."""

    def get(self, request):
        query_serializer = QueryParamsSerializer(data=request.query_params)
        if not query_serializer.is_valid():
            return Response({'error': 'Invalid query parameters', 'details': query_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        params = query_serializer.validated_data
        start_date = params.get('start_date', '2026-01-01')
        end_date = params.get('end_date', '2026-01-31')
        cutoff_time = params.get('cutoff_time', '11:00')
        resolution = params.get('resolution', 'exact_hourly')
        force_refresh = params.get('force_refresh', False)

        dataset = self.get_data(force_refresh=force_refresh)
        actuals = dataset.get('actuals', [])
        forecasts = dataset.get('forecasts', [])

        selector = ForecastSelector(cutoff_time_str=cutoff_time)
        match_result = selector.match_forecasts_and_actuals(
            actuals=actuals,
            forecasts=forecasts,
            cutoff_time_str=cutoff_time,
            resolution=resolution
        )

        filtered_series = self.filter_by_date_range(match_result['matched_series'], start_date, end_date)
        summary = AccuracyCalculator.calculate_summary_metrics(filtered_series)
        top_misses = AccuracyCalculator.get_top_forecast_misses(filtered_series, limit=5)

        return Response({
            'period': {'start_date': start_date, 'end_date': end_date},
            'cutoff_time_applied': cutoff_time,
            'resolution': resolution,
            'metrics': summary,
            'top_misses': top_misses,
        })


class AccuracySeriesView(BaseAnalyticsView):
    """GET /api/accuracy/series/ - Matched forecast vs actual time series and daily aggregates."""

    def get(self, request):
        query_serializer = QueryParamsSerializer(data=request.query_params)
        if not query_serializer.is_valid():
            return Response({'error': 'Invalid query parameters', 'details': query_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        params = query_serializer.validated_data
        start_date = params.get('start_date', '2026-01-01')
        end_date = params.get('end_date', '2026-01-31')
        cutoff_time = params.get('cutoff_time', '11:00')
        resolution = params.get('resolution', 'exact_hourly')
        force_refresh = params.get('force_refresh', False)

        dataset = self.get_data(force_refresh=force_refresh)
        actuals = dataset.get('actuals', [])
        forecasts = dataset.get('forecasts', [])

        selector = ForecastSelector(cutoff_time_str=cutoff_time)
        match_result = selector.match_forecasts_and_actuals(
            actuals=actuals,
            forecasts=forecasts,
            cutoff_time_str=cutoff_time,
            resolution=resolution
        )

        filtered_series = self.filter_by_date_range(match_result['matched_series'], start_date, end_date)
        daily_summary = AccuracyCalculator.calculate_daily_summary(filtered_series)

        return Response({
            'period': {'start_date': start_date, 'end_date': end_date},
            'cutoff_time_applied': cutoff_time,
            'resolution': resolution,
            'total_intervals': len(filtered_series),
            'matched_series': filtered_series,
            'daily_summary': daily_summary,
        })


class ForecastHistoryView(BaseAnalyticsView):
    """GET /api/forecast/history/?start_time=... - Revision history for a specific delivery interval."""

    def get(self, request):
        serializer = HistoryQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response({'error': 'Invalid query parameters', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        params = serializer.validated_data
        start_time = params['start_time']
        cutoff_time = params.get('cutoff_time', '11:00')

        dataset = self.get_data(force_refresh=False)
        forecasts = dataset.get('forecasts', [])
        actuals = dataset.get('actuals', [])

        # Find actual for this interval if present
        actual_match = next((a for a in actuals if a.get('startTime') == start_time), None)

        selector = ForecastSelector(cutoff_time_str=cutoff_time)
        history = selector.inspect_interval_revisions(
            target_iso=start_time,
            all_forecasts=forecasts,
            cutoff_time_str=cutoff_time
        )

        if 'error' in history:
            return Response(history, status=status.HTTP_400_BAD_REQUEST)

        history['actual_generation'] = actual_match.get('generation') if actual_match else None
        return Response(history)


class DataQualityView(BaseAnalyticsView):
    """GET /api/data-quality/ - Completeness audit, source links, and methodology notes."""

    def get(self, request):
        processor = DataProcessor()
        dataset = self.get_data(force_refresh=False)
        actuals = dataset.get('actuals', [])
        forecasts = dataset.get('forecasts', [])
        meta = dataset.get('metadata', {})

        audit = processor.compute_completeness_audit(actuals, forecasts)

        return Response({
            'metadata': meta,
            'audit': audit,
            'data_sources': {
                'fuelhh_actuals_stream': 'https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream',
                'windfor_forecasts_stream': 'https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream',
                'elexon_portal': 'https://bmrs.elexon.co.uk',
            },
            'methodology': {
                'timezone': 'Europe/London (GMT in January 2026, UTC+0)',
                'default_cutoff_rule': '11:00 Europe/London on D-1 (EPEX SPOT UK Day-Ahead auction gate closure)',
                'lookahead_bias_mitigation': 'Forecasts with publishTime > Cutoff are strictly excluded from decision-time evaluation.',
                'units': 'Megawatts (MW) for generation, MAE, RMSE, Bias; Percentage (%) for WAPE',
                'formulae': {
                    'MAE': 'sum(|Forecast - Actual|) / n',
                    'RMSE': 'sqrt(sum((Forecast - Actual)^2) / n)',
                    'Bias': 'sum(Forecast - Actual) / n',
                    'WAPE': '100 * sum(|Forecast - Actual|) / sum(|Actual|)',
                },
                'limitations': [
                    'Covers UK national transmission-system wind generation; does not model embedded wind or demand.',
                    'Procurement shortfall risk is illustrative of wind volume deviations and does not account for wholesale market hedging spreads or balancing mechanism bids/offers.',
                ]
            }
        })
