"""Thin HTTP client for CXDB context store."""

import json
import logging
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)


@dataclass
class CxdbContext:
    context_id: int
    head_turn_id: int
    head_depth: int


@dataclass
class CxdbTurn:
    turn_id: int
    parent_turn_id: int
    depth: int
    type_id: str
    type_version: int
    data: dict


class CxdbClient:
    def __init__(self, base_url: str) -> None:
        self._base = base_url.rstrip("/")
        self._session = requests.Session()

    def create_context(self, base_turn_id: int = 0, tag: str = "") -> CxdbContext:
        body: dict = {"base_turn_id": str(base_turn_id)}
        if tag:
            body["tag"] = tag
        resp = self._session.post(f"{self._base}/v1/contexts/create", json=body)
        resp.raise_for_status()
        d = resp.json()
        return CxdbContext(
            context_id=int(d["context_id"]),
            head_turn_id=int(d["head_turn_id"]),
            head_depth=int(d.get("head_depth", 0)),
        )

    def append_turn(
        self,
        context_id: int,
        type_id: str,
        data: dict,
        type_version: int = 1,
    ) -> int:
        resp = self._session.post(
            f"{self._base}/v1/contexts/{context_id}/append",
            json={
                "type_id": type_id,
                "type_version": type_version,
                "data": data,
            },
        )
        resp.raise_for_status()
        return int(resp.json().get("new_turn_id", 0))

    def list_contexts(self, tag: str = "", limit: int = 100) -> list[CxdbContext]:
        params: dict = {"limit": limit}
        if tag:
            params["tag"] = tag
        resp = self._session.get(f"{self._base}/v1/contexts", params=params)
        resp.raise_for_status()
        results = []
        for d in resp.json().get("contexts", []):
            results.append(CxdbContext(
                context_id=int(d["context_id"]),
                head_turn_id=int(d["head_turn_id"]),
                head_depth=int(d.get("head_depth", 0)),
            ))
        return results

    def get_turns(self, context_id: int, limit: int = 100) -> list[CxdbTurn]:
        resp = self._session.get(
            f"{self._base}/v1/contexts/{context_id}/turns",
            params={"limit": limit},
        )
        resp.raise_for_status()
        results = []
        for d in resp.json().get("turns", []):
            data = d.get("data", {})
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    data = {"raw": data}
            results.append(CxdbTurn(
                turn_id=int(d["turn_id"]),
                parent_turn_id=int(d.get("parent_turn_id", 0)),
                depth=int(d.get("depth", 0)),
                type_id=d.get("type_id", ""),
                type_version=int(d.get("type_version", 1)),
                data=data,
            ))
        return results

    def healthy(self) -> bool:
        try:
            resp = self._session.get(f"{self._base}/v1/contexts", params={"limit": 1})
            return resp.status_code == 200
        except requests.ConnectionError:
            return False
