# Support Backend (FastAPI)

This FastAPI service replaces the previous Supabase Edge Functions.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

The API listens on `http://localhost:8000` by default.

## Available endpoints

- `POST /api/session` – create a visitor session.
- `GET /api/session/{session_id}` – fetch the current ticket + message history.
- `POST /api/session/{session_id}/messages` – append a visitor message (and create/update the ticket as needed).
- `GET /api/health` – basic health check.

The frontend expects the API base URL (including the `/api` prefix) in `VITE_API_BASE_URL`.
