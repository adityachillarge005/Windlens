"""
API endpoint integration tests for WindLens.
Tests responses, status codes, query validation, and serialized outputs.
"""

from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse


class TestAnalyticsAPIEndpoints(APITestCase):
    """Integration test suite for the REST API endpoints."""

    def test_health_endpoint(self):
        """GET /api/health/ should return 200 OK and healthy status."""
        url = reverse('api-health')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'healthy')
        self.assertEqual(response.data.get('app'), 'WindLens')
        self.assertIn('data_cached', response.data)

    def test_accuracy_summary_endpoint(self):
        """GET /api/accuracy/summary/ should return 200 OK with metrics."""
        url = reverse('api-accuracy-summary')
        response = self.client.get(url, {'start_date': '2026-01-01', 'end_date': '2026-01-03', 'cutoff_time': '11:00'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('metrics', response.data)
        self.assertIn('mae_mw', response.data['metrics'])
        self.assertIn('rmse_mw', response.data['metrics'])
        self.assertIn('bias_mw', response.data['metrics'])
        self.assertIn('wape_percent', response.data['metrics'])
        self.assertIn('top_misses', response.data)

    def test_accuracy_series_endpoint(self):
        """GET /api/accuracy/series/ should return 200 OK with time series."""
        url = reverse('api-accuracy-series')
        response = self.client.get(url, {'start_date': '2026-01-01', 'end_date': '2026-01-02'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('matched_series', response.data)
        self.assertIn('daily_summary', response.data)

    def test_forecast_latest_endpoint(self):
        """GET /api/forecast/latest/ should return 200 OK with series and latest eligible publication."""
        url = reverse('api-forecast-latest')
        response = self.client.get(url, {'start_date': '2026-01-01', 'end_date': '2026-01-02'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('series', response.data)
        self.assertIn('cutoff_time_applied', response.data)

    def test_forecast_history_requires_start_time(self):
        """GET /api/forecast/history/ without start_time should return 400 Bad Request."""
        url = reverse('api-forecast-history')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('start_time', response.data.get('details', {}))

    def test_forecast_history_valid(self):
        """GET /api/forecast/history/?start_time=2026-01-01T12:00:00Z should return 200 OK."""
        url = reverse('api-forecast-history')
        response = self.client.get(url, {'start_time': '2026-01-01T12:00:00Z', 'cutoff_time': '11:00'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('publications', response.data)
        self.assertIn('cutoff_time_rule', response.data)

    def test_data_quality_endpoint(self):
        """GET /api/data-quality/ should return 200 OK with completeness audit and methodology."""
        url = reverse('api-data-quality')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('audit', response.data)
        self.assertIn('data_sources', response.data)
        self.assertIn('methodology', response.data)
        self.assertEqual(response.data['audit']['expected_half_hour_intervals'], 1488)
