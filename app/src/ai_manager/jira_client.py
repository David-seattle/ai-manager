import logging

import requests

logger = logging.getLogger(__name__)


class JiraClient:
    def __init__(self, base_url: str, email: str, api_token: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.auth = (email, api_token)
        self.session.headers["Accept"] = "application/json"

    def fetch_issue(self, key: str) -> dict | None:
        url = f"{self.base_url}/rest/api/2/issue/{key}"
        params = {"fields": "summary,description,status,assignee,priority"}
        try:
            resp = self.session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            fields = data.get("fields", {})
            return {
                "summary": fields.get("summary", ""),
                "description": fields.get("description", ""),
                "status": (fields.get("status") or {}).get("name", ""),
                "assignee": (fields.get("assignee") or {}).get("emailAddress", ""),
                "priority": (fields.get("priority") or {}).get("name", ""),
            }
        except (requests.RequestException, ConnectionError) as e:
            logger.warning("Failed to fetch Jira issue %s: %s", key, e)
            return None
