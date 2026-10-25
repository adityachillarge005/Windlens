# WindLens — UK Wind Forecast Analytics & Procurement Decision Platform

> A production-grade web application built for UK wholesale energy trading desks to evaluate day-ahead wind generation forecasts against Elexon BMRS outturns, quantify forecast uncertainty, and eliminate look-ahead bias in procurement decisions.

---

## 1. Project Overview & Business Problem

In Great Britain's wholesale electricity market, renewable generation—predominantly offshore and onshore wind—is inherently weather-dependent and volatile. Electricity procurement teams at UK utilities purchase power in day-ahead auctions (such as EPEX SPOT and Nord Pool) to cover expected customer demand.

When procuring power, trading desks must evaluate wind generation forecasts **available before the day-ahead auction gate closure** (typically 11:00 or 12:00 GMT on the day prior to delivery, $D-1$). 

Key commercial challenges:
1. **Look-Ahead Bias Risk**: Evaluating forecast accuracy using forecasts published *after* the auction gate closure distorts procurement strategies because those predictions were inaccessible when financial commitments were made.
2. **Imbalance Cost Exposure**:
   - **Over-forecasting ($F > A$)**: The utility contracts excess energy day-ahead and must spill or resell volume at potentially discounted intraday or cash-out prices.
   - **Under-forecasting ($F < A$)**: The utility is caught short and exposed to volatile cash-out / System Buy Prices in the Balancing Mechanism.
3. **Forecast Evolution Uncertainty**: Understanding how predictions shift across successive model runs provides vital context on meteorological conviction.

**WindLens** solves this by providing:
- Strict day-ahead decision cutoff filtering to isolate eligible forecasts with **zero look-ahead bias**.
- Direct comparison between decision-time predictions, latest available gate predictions, and metered actual generation.
- Rigorous statistical error metrics (MAE, RMSE, Mean Forecast Bias, WAPE).
- Granular forecast revision tracking and complete transparency into Elexon BMRS data quality.

---

## 2. Key Features

- **Decision-Time Forecast Isolation**: Configurable day-ahead procurement cutoff (default: `11:00` Europe/London on $D-1$; configurable to `12:00`, `14:00`, `17:00`). Forecasts published after the cutoff are strictly segregated.
- **Forecast vs. Actual Time-Series Monitor**: Interactive multi-line visualizer comparing decision-time forecasts, latest gate forecasts, and actual metered outturns across January 2026.
- **Comprehensive KPI Dashboard**:
  - **MAE (Mean Absolute Error)**: Average deviation magnitude in MW.
  - **RMSE (Root Mean Squared Error)**: Sensitivity to extreme deviations in MW.
  - **Mean Forecast Bias**: Systematic over-forecasting ($+$) or under-forecasting ($-$) in MW.
  - **WAPE (Weighted Absolute Percentage Error)**: Volume-weighted percentage error relative to national generation.
- **Error Residuals & Scatter Plot**: Visual residual distribution over time ($F_i - A_i$) and parity scatter plot with $y=x$ ideal reference.
- **Largest Forecast Misses**: Rapid identification and inspection of top over-forecasts and under-forecasts.
- **Interval Revision History**: Deep dive into any individual half-hour or hourly delivery interval showing all successive Elexon model runs, lead time in hours, revision deltas ($\Delta \text{MW}$), and the forecast active at cutoff.
- **Data Quality & Completeness Audit**: Verification of all 1,488 expected half-hour delivery intervals in January 2026.

---

## 3. Architecture & Technology Stack

```
   ┌─────────────────────────────────────────────────────────────┐
   │               Frontend (React 18 + Vite)                    │
   │   - Recharts (Interactive Line, Bar, Scatter, Step Charts)   │
   │   - Tailwind CSS (Enterprise Dark Mode UI)                  │
   │   - Responsive Lucide-React Dashboard Components            │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ HTTP REST (JSON)
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │            Backend (Django 6 + REST Framework)              │
   │  ┌───────────────────────┐       ┌───────────────────────┐  │
   │  │ ForecastSelector      │       │ AccuracyCalculator    │  │
   │  │ (D-1 Cutoff Engine)   │       │ (MAE, RMSE, Bias, WAPE│  │
   │  └───────────────────────┘       └───────────────────────┘  │
   │  ┌───────────────────────┐       ┌───────────────────────┐  │
   │  │ DataProcessor         │       │ ElexonClient          │  │
   │  │ (TZ Normalization)    │       │ (Stream API & Retry)  │  │
   │  └───────────────────────┘       └───────────────────────┘  │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │               Official Data Source (Elexon BMRS)            │
   │   - Actuals: /datasets/FUELHH/stream (fuelType=WIND)        │
   │   - Forecasts: /datasets/WINDFOR/stream                     │
   └─────────────────────────────────────────────────────────────┘
```

- **Frontend**: React 18, Vite, JavaScript, Recharts, Tailwind CSS, Lucide React.
- **Backend**: Python 3.13, Django 6, Django REST Framework, NumPy, Pandas, Requests, Django-CORS-Headers.
- **Persistence & Caching**: Local disk/SQLite persistent caching of raw Elexon records to eliminate redundant upstream calls and ensure sub-millisecond query responses.
- **Containerization & Deployment**: Multi-stage Docker, Docker Compose, Nginx, Gunicorn.

---

## 4. Directory & File Structure

```
WindLens/
├── backend/
│   ├── analytics/
│   │   ├── services/
│   │   │   ├── elexon_client.py         # Elexon BMRS stream client with retries & backoff
│   │   │   ├── data_processing.py       # Timezone handling, cleaning, deduplication & cache
│   │   │   ├── forecast_selection.py    # D-1 decision cutoff engine & look-ahead bias prevention
│   │   │   └── accuracy_metrics.py      # MAE, RMSE, Bias, WAPE, top misses & distributions
│   │   ├── tests/
│   │   │   ├── test_forecast_selection.py  # Unit tests for cutoff and look-ahead exclusion
│   │   │   ├── test_accuracy_metrics.py    # Unit tests for metrics and zero-denominators
│   │   │   ├── test_data_processing.py     # Unit tests for timestamp parsing and cleaning
│   │   │   └── test_api_endpoints.py       # Integration tests for DRF endpoints
│   │   ├── views.py                     # DRF API views
│   │   ├── serializers.py               # Serializers and parameter validation
│   │   └── urls.py                      # REST route definitions
│   ├── config/                          # Django project settings and URLs
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── Procfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/                  # KPICard, LoadingSpinner, ErrorMessage
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx            # View A: Forecast Monitor
│   │   │   ├── Accuracy.jsx             # View B: Forecast Accuracy & Outturn Matching
│   │   │   ├── ForecastHistory.jsx      # View C: Interval Revision Step History
│   │   │   └── Methodology.jsx          # View D: Data Quality & Completeness Audit
│   │   ├── services/
│   │   │   └── api.js                   # Centralized API client
│   │   ├── App.jsx                      # Navigation, global cutoff state, date filters
│   │   ├── main.jsx
│   │   └── index.css                    # Tailwind CSS directives
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf                       # Docker Nginx reverse proxy
│   ├── Dockerfile
│   └── vercel.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 5. Official Data Sources & Documentation

All data is queried directly from official Elexon Balancing Mechanism Reporting Service (BMRS) Open API v1 stream endpoints:

1. **Actual Wind Generation (`FUELHH`)**:
   - Documentation: [https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
   - Stream Endpoint: `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream`
   - Filter criteria: `fuelType == 'WIND'`
   - Timestamp mapping: `startTime` = start of the delivery interval
   - Value: `generation` = actual outturn wind generation in Megawatts (MW)

2. **Forecast Wind Generation (`WINDFOR`)**:
   - Documentation: [https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
   - Stream Endpoint: `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream`
   - Timestamp mapping: `startTime` = target delivery interval; `publishTime` = model publication timestamp
   - Value: `generation` = forecast wind generation in Megawatts (MW)

---

## 6. Scope & January 2026 Completeness

The target analysis scope is **January 1 to January 31, 2026**.

- January contains 31 calendar days.
- In Great Britain, electricity settlement is structured in half-hour intervals (48 settlement periods per day).
- Total expected half-hourly settlement intervals: $31 \times 48 = \mathbf{1,488}$.
- Total expected hourly delivery intervals: $31 \times 24 = \mathbf{744}$.
- **Completeness Verification**:
  - Verified against live Elexon data: 1,488 valid half-hour actual intervals found (**100.0% coverage**).
  - 744 hourly forecast intervals found (**100.0% coverage**).
  - Missing actuals: 0. Missing forecast hours: 0.

---

## 7. Decision-Time Forecast Selection Methodology

The day-ahead wholesale electricity procurement decision occurs on **$D-1$** (the calendar day preceding delivery day $D$).

### Cutoff Calculation:
For any delivery interval with target timestamp $T$ on delivery day $D$ (in `Europe/London`):
$$\text{Cutoff}(T) = (D - 1\text{ day}) \text{ at } [H_{\text{cutoff}}] \text{ Europe/London}$$

- **Default Assumption**: **11:00 GMT on $D-1$** (documented EPEX SPOT UK Day-Ahead auction gate closure).
- **Configurability**: Operators can adjust this to 12:00 (Nord Pool gate), 14:00, or 17:00 via the UI dropdown.

### Look-Ahead Bias Mitigation:
1. For interval $T$, candidate forecast publications are filtered such that:
   $$\text{publishTime} \le \text{Cutoff}(T)$$
2. Any forecast published after $\text{Cutoff}(T)$ is **strictly excluded** from the decision-time forecast metric.
3. The selected decision-time forecast $F_{\text{decision}}(T)$ is the candidate having the maximum $\text{publishTime}$ among eligible records:
   $$F_{\text{decision}}(T) = \operatorname{argmax}_{\text{publishTime} \le \text{Cutoff}(T)} (\text{publishTime})$$
4. If no forecast was published prior to cutoff, the interval is flagged as `missing_decision_forecast` and excluded from matched metrics.

---

## 8. Timestamp & Timezone Handling

- **Source Timestamps**: Parsed into timezone-aware `datetime` objects normalized to UTC (`YYYY-MM-DDTHH:MM:SSZ`).
- **Calendar Alignment**: UK local date boundaries are evaluated in `Europe/London`. In January, the UK observes Greenwich Mean Time (GMT, UTC+0). The codebase natively handles British Summer Time (BST, UTC+1) transitions.
- **Deduplication**:
  - Actuals (`FUELHH`): Deduplicated on `startTime`.
  - Forecasts (`WINDFOR`): Deduplicated on `(startTime, publishTime)`.

---

## 9. Accuracy Metrics & Interpretation

For $n$ valid matched delivery intervals with forecast $F_i$ and actual $A_i$:

### Error Definition:
$$e_i = F_i - A_i \quad (\text{MW})$$
- $e_i > 0$: **Over-forecast** (Forecast exceeds actual).
- $e_i < 0$: **Under-forecast** (Actual exceeds forecast).

### Metric Formulas:

| Metric | Mathematical Formula | Units | Procurement Interpretation |
| :--- | :--- | :--- | :--- |
| **MAE** | $\frac{1}{n} \sum_{i=1}^n \|F_i - A_i\|$ | MW | Average expected volume error without disproportionate penalty on outliers. |
| **RMSE** | $\sqrt{\frac{1}{n} \sum_{i=1}^n (F_i - A_i)^2}$ | MW | Heavily penalizes large misses; critical for identifying extreme imbalance risk. |
| **Bias** | $\frac{1}{n} \sum_{i=1}^n (F_i - A_i)$ | MW | Systematic directional bias. Positive indicates buying too much power day-ahead. |
| **WAPE** | $100 \times \frac{\sum_{i=1}^n \|F_i - A_i\|}{\sum_{i=1}^n \|A_i\|}$ | % | Total volume error relative to total grid outturn. Normalizes for seasonal scale. |

### Zero-Denominator Guarantees:
If $n = 0$, all metrics return `null`. If $\sum |A_i| = 0$, WAPE returns `null`. Undefined metrics are never fabricated or reported as zero.

---

## 10. Data Limitations & Scope Disclosures

- **National Transmission System Scope**: BMRS `FUELHH` and `WINDFOR` cover transmission-connected wind across Great Britain. Embedded distribution-level wind and private wire installations are outside this dataset.
- **Procurement Portfolio Exposure**: Under-forecast wind indicates potential replacement volume risk in wholesale trading. However, this application does not calculate an absolute financial imbalance position because consumer demand curves, portfolio hedges, and balancing cash-out prices (SBP/SSP) are outside the scope.

---

## 11. Prerequisites

- Python 3.11+ (Python 3.13 supported)
- Node.js 18+ (Node 22 / 25 supported) and npm
- Docker and Docker Compose (optional for containerized execution)
- Git

---

## 12. Local Development Startup

### Backend Setup:
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (optional)
python -m venv venv
# Linux/macOS: source venv/bin/activate
# Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations and system checks
python manage.py migrate
python manage.py check

# Run backend development server
python manage.py runserver 127.0.0.1:8000
```
Backend API will be accessible at: `http://127.0.0.1:8000/api/health/`

### Frontend Setup:
```bash
# Open a new terminal in the frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend will be accessible at: `http://localhost:5173/`

---

## 13. Docker & Docker Compose Startup

To launch both frontend and backend in isolated production containers:

```bash
# From the project root:
docker compose up --build
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000/api/health/`

To stop:
```bash
docker compose down
```

---

## 14. Environment Variables

Create `.env` based on `.env.example`:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DEBUG` | Django debug mode (`True`/`False`) | `False` |
| `SECRET_KEY` | Django cryptographic secret key | (Set in production) |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames | `*` |
| `CORS_ALLOW_ALL_ORIGINS` | Allow cross-origin browser requests | `True` |
| `ELEXON_BASE_URL` | Base URL for Elexon BMRS API | `https://data.elexon.co.uk/bmrs/api/v1` |
| `VITE_API_BASE_URL` | Backend URL for frontend queries | `http://localhost:8000/api` |

---

## 15. Automated Tests

The backend test suite contains **21 unit and integration tests** covering cutoff calculation, look-ahead bias exclusion, timestamp normalization, data cleaning, accuracy metric edge cases, zero denominators, and API response serialization:

```bash
cd backend
python manage.py test analytics
```

All 21 tests execute in under 0.3 seconds.

---

## 16. API Endpoints Reference

| Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health/` | Health check, cache status, record counts | None |
| `GET` | `/api/forecast/latest/` | Filtered time series with decision-time & latest forecast | `start_date`, `end_date`, `cutoff_time`, `resolution` |
| `GET` | `/api/accuracy/summary/` | Summary metrics (MAE, RMSE, Bias, WAPE, top misses) | `start_date`, `end_date`, `cutoff_time`, `resolution` |
| `GET` | `/api/accuracy/series/` | Interval-level matched series & daily aggregations | `start_date`, `end_date`, `cutoff_time`, `resolution` |
| `GET` | `/api/forecast/history/` | Chronological forecast revisions for an interval | `start_time` (required), `cutoff_time` |
| `GET` | `/api/data-quality/` | Completeness audit (1,488 intervals) & methodology | None |

---

## 17. AI-Tool Disclosure

In accordance with hiring challenge guidelines, AI tools (Google Antigravity agentic pair programming) were utilized to assist with research of Elexon BMRS documentation, code scaffolding, test case generation, and UI layout. All analytical business logic, look-ahead bias mitigation rules, mathematical formulas, and data processing implementations were verified, validated against real BMRS outturns, and tested with automated unit and integration suites.

---

## 18. Assumptions & Future Improvements

- **EPEX SPOT Day-Ahead Auction Default**: The default decision cutoff is assumed to be 11:00 Europe/London on $D-1$. The application supports dynamic selection between 11:00, 12:00, 14:00, and 17:00.
- **Resolution Mapping**: By default, exact hourly matching matches the hourly WINDFOR forecasts to :00 delivery periods (744 periods in January). The toggleable `half_hourly_mapped` mode maps hourly forecasts across both constituent half-hour settlement periods (1,488 periods in January).
- **Future Improvements**:
  - Incorporate Elexon System Buy Price (SBP) / System Sell Price (SSP) imbalance cash-out pricing to attach GBP (£) financial values to MW forecast deviations.
  - Add regional wind breakdown (e.g. Scottish export constraints) when nodal/zonal data is released.
