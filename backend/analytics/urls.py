"""
API URLs for WindLens analytics app.
"""

from django.urls import path
from .views import (
    HealthView,
    ForecastLatestView,
    AccuracySummaryView,
    AccuracySeriesView,
    ForecastHistoryView,
    DataQualityView,
)

urlpatterns = [
    path('health/', HealthView.as_view(), name='api-health'),
    path('forecast/latest/', ForecastLatestView.as_view(), name='api-forecast-latest'),
    path('accuracy/summary/', AccuracySummaryView.as_view(), name='api-accuracy-summary'),
    path('accuracy/series/', AccuracySeriesView.as_view(), name='api-accuracy-series'),
    path('forecast/history/', ForecastHistoryView.as_view(), name='api-forecast-history'),
    path('data-quality/', DataQualityView.as_view(), name='api-data-quality'),
]
