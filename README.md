# AI Manager

Loads project data (beads, Jira items, git workspace) into SQLite and serves it via Datasette, with a React dashboard for exploration.

## Quick Start

```bash
cp .env.example .env
# Set WORKSPACE_PATH to your local workspace repo
# Optionally configure Jira credentials
docker compose up --build
```

- **Datasette API**: http://localhost:8011
- **Dashboard**: http://localhost:5174

The workspace directory should contain `beads/` and/or `jira/` subdirectories with work item data. Set `WORKSPACE_PATH` to the absolute path of your workspace repo. Leave `WORKSPACE_REPO_URL` empty when using a local bind mount.

## Project Structure

- `app/` — Python loader + Datasette (data ingestion and API)
- `dashboard/` — React + Vite frontend
