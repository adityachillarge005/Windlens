"""
Serializers for WindLens REST API.
Provides validation and schema definitions for API requests and responses.
"""

from rest_framework import serializers


class QueryParamsSerializer(serializers.Serializer):
    """Query parameters for filtering analytics and time series."""
    start_date = serializers.CharField(required=False, default="2026-01-01")
    end_date = serializers.CharField(required=False, default="2026-01-31")
    cutoff_time = serializers.CharField(required=False, default="11:00")
    resolution = serializers.ChoiceField(
        choices=["exact_hourly", "half_hourly_mapped"],
        default="exact_hourly",
        required=False
    )
    force_refresh = serializers.BooleanField(required=False, default=False)


class HistoryQuerySerializer(serializers.Serializer):
    """Query parameter for inspecting forecast revisions for an interval."""
    start_time = serializers.CharField(required=True)
    cutoff_time = serializers.CharField(required=False, default="11:00")


class HealthResponseSerializer(serializers.Serializer):
    """Health check payload."""
    status = serializers.CharField()
    app = serializers.CharField()
    version = serializers.CharField()
    data_cached = serializers.BooleanField()
    last_retrieval = serializers.CharField(allow_null=True)
    actuals_count = serializers.IntegerField()
    forecasts_count = serializers.IntegerField()


class AccuracyMetricUnitsSerializer(serializers.Serializer):
    mae = serializers.CharField()
    rmse = serializers.CharField()
    bias = serializers.CharField()
    wape = serializers.CharField()
    generation = serializers.CharField()


class AccuracySummaryResponseSerializer(serializers.Serializer):
    """Summary KPI metrics response."""
    valid_matched_count = serializers.IntegerField()
    mae_mw = serializers.FloatField(allow_null=True)
    rmse_mw = serializers.FloatField(allow_null=True)
    bias_mw = serializers.FloatField(allow_null=True)
    wape_percent = serializers.FloatField(allow_null=True)
    mean_actual_mw = serializers.FloatField(allow_null=True)
    mean_forecast_mw = serializers.FloatField(allow_null=True)
    total_actual_mw = serializers.FloatField(allow_null=True)
    total_forecast_mw = serializers.FloatField(allow_null=True)
    max_overforecast_mw = serializers.FloatField(allow_null=True)
    max_underforecast_mw = serializers.FloatField(allow_null=True)
    units = AccuracyMetricUnitsSerializer()
    cutoff_time_applied = serializers.CharField()
    resolution = serializers.CharField()
