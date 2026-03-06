#!/usr/bin/env bash
# Smoke test for AI Manager — parallel-safe via unique project name.
#
# Each invocation gets its own docker compose project with isolated
# containers, volumes, and network. Multiple polecats (or humans)
# can run this simultaneously without port or name conflicts.
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
    echo "FAIL: Docker is not running"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="aim-smoke-$$-$(date +%s)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# Use port 0 trick: let the OS pick free ports
APP_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')
DASH_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')

cleanup() {
    echo "Tearing down $PROJECT..."
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Smoke test: $PROJECT ==="
echo "  App port: $APP_PORT, Dashboard port: $DASH_PORT"

# Start containers with unique project name and random ports
DATASETTE_PORT="$APP_PORT" DASHBOARD_PORT="$DASH_PORT" \
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d --build --wait 2>&1

# Wait for Datasette to be ready (up to 30s)
echo "Waiting for Datasette..."
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$APP_PORT" >/dev/null 2>&1; then
        echo "  Datasette ready after ${i}s"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "FAIL: Datasette not ready after 30s"
        docker compose -p "$PROJECT" -f "$COMPOSE_FILE" logs app
        exit 1
    fi
    sleep 1
done

FAILED=0

# Test 1: Datasette root responds
echo -n "  [1/4] Datasette root... "
if curl -sf "http://localhost:$APP_PORT" >/dev/null; then
    echo "OK"
else
    echo "FAIL"
    FAILED=1
fi

# Test 2: work_items table exists and returns JSON
echo -n "  [2/4] work_items.json... "
RESP=$(curl -sf "http://localhost:$APP_PORT/ai_manager/work_items.json?_size=1" 2>/dev/null || true)
if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'rows' in d or 'ok' in d" 2>/dev/null; then
    echo "OK"
elif echo "$RESP" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    echo "OK (valid JSON)"
else
    echo "FAIL: unexpected response"
    echo "  Response: ${RESP:0:200}"
    FAILED=1
fi

# Test 3: documents table exists
echo -n "  [3/4] documents.json... "
if curl -sf "http://localhost:$APP_PORT/ai_manager/documents.json?_size=1" >/dev/null; then
    echo "OK"
else
    echo "FAIL"
    FAILED=1
fi

# Test 4: sessions table exists
echo -n "  [4/4] sessions.json... "
if curl -sf "http://localhost:$APP_PORT/ai_manager/sessions.json?_size=1" >/dev/null; then
    echo "OK"
else
    echo "FAIL"
    FAILED=1
fi

if [ "$FAILED" -eq 0 ]; then
    echo "=== All smoke tests passed ==="
else
    echo "=== Some smoke tests FAILED ==="
    exit 1
fi
