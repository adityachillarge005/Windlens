"""
URL configuration for WindLens backend.
"""

from django.contrib import admin
from django.urls import path, include
from analytics.views import HealthView

urlpatterns = [
    # Root and top-level health checks for hosting platforms (Render, Docker, load balancers)
    path('', HealthView.as_view(), name='root-health'),
    path('health/', HealthView.as_view(), name='base-health'),

    # Admin and API endpoints
    path('admin/', admin.site.urls),
    path('api/', include('analytics.urls')),
]
