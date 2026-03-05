---
status: current
decider-type: team
decider: engineering
date: 2026-02-20
tags:
  - architecture
  - database
---

## Decision

Use SQLite as the primary data store for the dashboard.

## Problem / Context

Need a lightweight database that can be bundled with the application and served via Datasette.

## Alternatives Considered

PostgreSQL was considered but adds operational complexity for a read-heavy dashboard use case.
