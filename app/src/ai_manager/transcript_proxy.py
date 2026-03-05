import json
import logging
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

logger = logging.getLogger(__name__)


class TranscriptHandler(BaseHTTPRequestHandler):
    transcript_store: Any = None

    def do_GET(self) -> None:
        match = re.match(r"^/transcript/([a-zA-Z0-9_-]+)$", self.path)
        if not match:
            self.send_error(404, "Not found")
            return

        session_id = match.group(1)
        store = self.__class__.transcript_store
        if store is None:
            self.send_error(503, "Transcript store not configured")
            return

        try:
            raw = store.download_transcript(session_id)
        except Exception:
            logger.exception("Failed to download transcript %s", session_id)
            self.send_error(404, "Transcript not found")
            return

        body = json.dumps({"session_id": session_id, "content": raw}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:
        logger.debug("TranscriptProxy: " + fmt, *args)


def start_proxy(transcript_store: Any, port: int = 8002) -> ThreadingHTTPServer:
    TranscriptHandler.transcript_store = transcript_store
    server = ThreadingHTTPServer(("0.0.0.0", port), TranscriptHandler)
    return server
