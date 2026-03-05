import json
import threading
import urllib.request
from unittest.mock import MagicMock

import pytest

from ai_manager.transcript_proxy import start_proxy


@pytest.fixture()
def proxy_server():
    store = MagicMock()
    store.download_transcript.return_value = (
        '{"type":"user","timestamp":"2026-01-01T00:00:00Z","message":{"content":"hello"}}\n'
        '{"type":"assistant","timestamp":"2026-01-01T00:00:01Z","message":{"content":[{"type":"text","text":"hi"}]}}\n'
    )
    server = start_proxy(store, port=0)  # port 0 = random available port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server, store
    server.shutdown()


def test_download_transcript(proxy_server):
    server, store = proxy_server
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/transcript/test-session-123"

    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())

    assert data["session_id"] == "test-session-123"
    assert "hello" in data["content"]
    store.download_transcript.assert_called_once_with("test-session-123")


def test_not_found_path(proxy_server):
    server, _ = proxy_server
    port = server.server_address[1]

    req = urllib.request.Request(f"http://127.0.0.1:{port}/invalid/path")
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 404


def test_missing_transcript(proxy_server):
    server, store = proxy_server
    store.download_transcript.side_effect = Exception("not found")
    port = server.server_address[1]

    req = urllib.request.Request(f"http://127.0.0.1:{port}/transcript/missing")
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 404
