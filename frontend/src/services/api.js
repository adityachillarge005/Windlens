/**
 * API service module for WindLens frontend.
 * Communicates with the Django REST Framework backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

async function request(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
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
