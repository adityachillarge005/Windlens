# WindLens — Video Demonstration & Submission Guide

This document provides a speaking script, screen-by-screen walkthrough, and submission checklist for the Wellfound Hiring Challenge.

---

## 1. Video Recording Outline (Maximum 10 Minutes)

The submission requires an **unlisted YouTube video** of at most 10 minutes, divided into two 5-minute parts.

### Part 1: Customer Presentation (Max 5 Minutes)
*Target Audience: Commercial Energy Procurement Lead / Utility Trading Desk*

- **0:00 - 1:00: Problem Context & The Day-Ahead Decision Dilemma**
  - "UK energy utilities purchase electricity in the wholesale day-ahead auction (such as EPEX SPOT) to balance customer demand. Wind generation is volatile and weather-dependent.
  - Critical challenge: When traders submit day-ahead bids (gate closure at 11:00 GMT on D-1), they only have access to forecasts published *before* that cutoff. Evaluating historical forecasts with newer revisions published during intraday creates **look-ahead bias** and distorts hedging decisions.
  - WindLens was built specifically to eliminate look-ahead bias, benchmark decision-time forecasts against outturn actuals, and quantify procurement uncertainty."

- **1:00 - 2:30: Dashboard / Forecast Monitor Walkthrough**
  - *Show the Dashboard tab*:
    - Point out the active **Cutoff assumption**: `11:00 Europe/London (D-1)`.
    - Point out the **Latest Eligible Publication** timestamp.
    - Show the multi-line chart comparing:
      1. **Decision-Time Forecast (Blue)**: The exact forecast available at day-ahead gate closure.
      2. **Latest Available Forecast (Indigo dashed)**: The final forecast published closer to gate.
      3. **Actual Metered Generation (Green)**: Metered UK wind from Elexon FUELHH.
    - Demonstrate switching the cutoff (e.g. from 11:00 to 12:00 or 14:00) and show how the decision forecast dynamically recalculates.

- **2:30 - 3:45: Forecast Accuracy & Financial Implications**
  - *Switch to the Forecast Accuracy tab*:
    - Highlight the 4 KPI cards:
      - **MAE (2,052 MW)**: Typical volume error per delivery period.
      - **RMSE (2,563 MW)**: Disproportionately penalizes extreme misses.
      - **Mean Forecast Bias (+1,753 MW)**: Shows a consistent tendency to over-forecast wind in January 2026.
      - **WAPE (17.98%)**: Error relative to total grid volume.
    - *Explain procurement impact*: "A positive bias means our desk consistently bought too much wind power day-ahead and had to spill or resell excess power. If bias was negative, we would be caught short, exposed to high cash-out prices in the Balancing Mechanism."
    - Scroll down to the **Error Over Time** and **Scatter Plot** ($y=x$ line).
    - Show the **Top Misses** table and click "Inspect Revisions" on an interval.

- **3:45 - 4:40: Forecast Revisions Deep-Dive**
  - *Show the Forecast History tab*:
    - Demonstrate how the step chart shows the evolution of forecasts over time.
    - Point out the **Active at Cutoff** badge versus the **Post-Cutoff / Intraday** badge.
    - Show that post-cutoff revisions are clearly segregated to prevent look-ahead bias.

- **4:40 - 5:00: Honest Disclosures of System Boundaries**
  - *Switch to Methodology tab*:
    - State clearly: "WindLens uses official Elexon BMRS transmission-system wind data. It does not model embedded wind or retail demand shapes, which are outside the challenge scope."

---

### Part 2: Internal Technical Review (Max 5 Minutes)
*Target Audience: Senior Full-Stack Engineers & Technical Evaluators*

- **5:00 - 6:00: Architecture & Data Flow**
  - "The system is structured as a decoupled full-stack application:
    - **Frontend**: React 18, Vite, Tailwind CSS, and Recharts.
    - **Backend**: Python 3.13, Django 6, and Django REST Framework.
    - **Data Pipeline**: Queries Elexon BMRS Open API v1 `/datasets/FUELHH/stream` and `/datasets/WINDFOR/stream` with exponential backoff and persistent local caching to ensure sub-millisecond API responses."

- **6:00 - 7:15: Deep Dive into Backend Logic**
  - *Open code editor to show key backend files*:
    - `backend/analytics/services/forecast_selection.py`:
      - Walk through `compute_day_ahead_cutoff()`: Evaluates local delivery date $D$ in `Europe/London`, subtracts 1 day ($D-1$), applies the cutoff hour, and converts to UTC.
      - Walk through `select_forecast_at_cutoff()`: Strictly filters `publishTime <= cutoff_dt`, preventing look-ahead bias.
    - `backend/analytics/services/accuracy_metrics.py`:
      - Walk through `calculate_summary_metrics()`: Shows NumPy vectorized calculations for MAE, RMSE, Bias, and WAPE with explicit `if sum_actuals == 0: return None` zero-denominator protection.
    - `backend/analytics/services/data_processing.py`:
      - Shows timestamp parsing, cleaning small negative sensor anomalies, deduplication, and the 1,488-interval completeness audit.

- **7:15 - 8:15: Automated Test Suite & Quality Verification**
  - *Open terminal and run*:
    ```bash
    cd backend
    python manage.py test analytics
    ```
  - Show the output: **21 tests passing in ~0.2 seconds**.
  - Mention what is tested:
    - Exclusion of post-cutoff forecasts.
    - Look-ahead bias prevention.
    - Duplicate publications handling.
    - Timezone normalization (UTC & Europe/London).
    - Zero denominators and edge cases.
    - DRF API endpoint response contracts.

- **8:15 - 9:15: Docker & Deployment Configuration**
  - Show `docker-compose.yml`:
    - Multi-stage build for frontend with Nginx reverse proxy.
    - Gunicorn backend with healthcheck.
    - Data cache volume mount.
  - Show `frontend/vercel.json` and `backend/Procfile` for cloud deployment.

- **9:15 - 10:00: Summary, Trade-offs & Next Steps**
  - "Trade-offs: We chose SQLite and disk caching over Postgres/Redis to keep infrastructure lightweight, defensible, and zero-maintenance within the 16-hour scope.
  - Next steps: In a production utility environment, we would integrate the Elexon System Buy Price (SBP) / System Sell Price (SSP) cash-out feed to calculate financial £/MWh portfolio imbalance exposure."

---

## 2. GitHub Repository Setup Guide

To push the codebase to your public GitHub account with an anonymous name:

```bash
# 1. Create a new public repository on GitHub with an anonymous name, for example:
#    repo-wl-7942  or  wl-eval-2026

# 2. In your terminal, link your remote:
git remote add origin https://github.com/<your-username>/<your-anonymous-repo-name>.git

# 3. Push main branch:
git push -u origin main
```

---

## 3. Public Deployment Guide

### Option A: Vercel (Frontend) + Render/Heroku (Backend)

1. **Deploy Backend (Render or Heroku)**:
   - Create a Web Service on Render / Heroku pointing to `backend/`.
   - Start Command: `gunicorn --workers 3 --timeout 120 config.wsgi:application`
   - Set Environment Variables:
     - `DEBUG` = `False`
     - `SECRET_KEY` = `<secure-random-key>`
     - `ALLOWED_HOSTS` = `*`
     - `CORS_ALLOW_ALL_ORIGINS` = `True`
   - Verify health: `https://<your-backend-app>.onrender.com/api/health/`

2. **Deploy Frontend (Vercel)**:
   - Import your GitHub repo in Vercel.
   - Set Root Directory: `frontend`
   - Set Environment Variable:
     - `VITE_API_BASE_URL` = `https://<your-backend-app>.onrender.com/api`
   - Deploy. Verify that the live dashboard displays real Elexon data.

---

## 4. Final Submission Checklist

The hiring submission form is:
[https://forms.cloud.microsoft/r/FTX6K2bbnU](https://forms.cloud.microsoft/r/FTX6K2bbnU)

Checklist before submitting:
- [ ] Public GitHub repository created with an anonymous name.
- [ ] Verified that commits do not contain personal email, tokens, or credentials.
- [ ] Live application deployed and accessible via public URL.
- [ ] Live URL verified in an incognito/private browser tab.
- [ ] Unlisted YouTube video recorded (<= 10 mins) and verified in an incognito window.
- [ ] All required fields in the Microsoft Form reviewed before final submit.
