# AI Manager

Loads project data (beads, Jira items, git workspace) into SQLite and serves it via Datasette, with a React dashboard for exploration.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your credentials
docker compose up --build
```

- **Datasette API**: http://localhost:8001
- **Dashboard**: http://localhost:5173

## Project Structure

- `app/` — Python loader + Datasette (data ingestion and API)
- `dashboard/` — React + Vite frontend
