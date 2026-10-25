/**
 * API service module for WindLens frontend.
 * Communicates with the Django REST Framework backend.
 */

// In local development, default to local Django port 8000.
// In containerized/cloud deployments, default to relative '/api' proxy or VITE_API_BASE_URL.
const rawBase = import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000/api'
    : '/api');

const API_BASE = rawBase.replace(/\/+$/, '');

async function request(endpoint, params = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${API_BASE}${cleanEndpoint}`;
  const url = new URL(fullUrl, window.location.origin);

  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, val);
    }
  });

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody.error || `HTTP error ${response.status}: ${response.statusText}`;
      const err = new Error(message);
      err.status = response.status;
      err.details = errBody.details;
      throw err;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  getHealth: () => request('/health/'),
  getForecastLatest: (params = {}) => request('/forecast/latest/', params),
  getAccuracySummary: (params = {}) => request('/accuracy/summary/', params),
  getAccuracySeries: (params = {}) => request('/accuracy/series/', params),
  getForecastHistory: (startTime, cutoffTime = '11:00') => 
    request('/forecast/history/', { start_time: startTime, cutoff_time: cutoffTime }),
  getDataQuality: () => request('/data-quality/'),
};
