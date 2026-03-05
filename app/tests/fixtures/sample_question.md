---
status: open
raised-by: dtarico
raised-date: 2026-03-01
source: planning
---

## Question

Should we cache Jira API responses locally or re-fetch on every sync cycle?

## Context

The loader fetches Jira issue details for EN- prefixed items. Rate limiting is a concern.

## Impact

If we always re-fetch, we may hit Jira API rate limits during frequent syncs.
