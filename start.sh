#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# MatrixPro — Start Script
# Launches backend (FastAPI) and frontend (HTTP server),
# then opens the app in your default browser.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
fail()  { printf "${RED}[ERROR]${NC} %s\n" "$*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

BACKEND_PORT="${MATRIXPRO_BACKEND_PORT:-8000}"
FRONTEND_PORT="${MATRIXPRO_FRONTEND_PORT:-3000}"
BACKEND_PID=""
FRONTEND_PID=""
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

port_pids() {
    lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

http_ok() {
    curl -sf --max-time 2 "$1" >/dev/null 2>&1
}

free_port_if_stuck() {
    local port="$1" label="$2" probe_url="$3"
    local pids
    pids="$(port_pids "$port")"
    [ -z "$pids" ] && return 0

    if http_ok "$probe_url"; then
        warn "$label port $port already in use by a healthy service (PID: $(echo "$pids" | tr '\n' ' '))"
        return 0
    fi

    warn "$label port $port is occupied but not responding — stopping stale process(es)..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
}

cleanup() {
    echo ""
    info "Shutting down..."
    [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null && ok "Backend stopped"
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend stopped"
    exit 0
}
trap cleanup SIGINT SIGTERM

# ── Preflight checks ─────────────────────────────────────────
[ -d "$PROJECT_ROOT/backend/venv" ] || fail "Virtual environment not found. Run ./setup.sh first."
[ -f "$PROJECT_ROOT/data/matrixpro.db" ] || fail "Database not found. Run ./setup.sh first."
[ -f "$PROJECT_ROOT/.env" ] || fail ".env not found. Run ./setup.sh first."

free_port_if_stuck "$BACKEND_PORT" "Backend" "http://127.0.0.1:$BACKEND_PORT/api/health"
free_port_if_stuck "$FRONTEND_PORT" "Frontend" "http://127.0.0.1:$FRONTEND_PORT/"

# ── Start backend ─────────────────────────────────────────────
if http_ok "http://127.0.0.1:$BACKEND_PORT/api/health"; then
    ok "Backend already running on port $BACKEND_PORT"
else
    info "Starting backend on port $BACKEND_PORT..."
    cd "$PROJECT_ROOT/backend"
    # shellcheck disable=SC1091
    source venv/bin/activate
    nohup uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" \
        >> "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    cd "$PROJECT_ROOT"
fi

# ── Start frontend ────────────────────────────────────────────
if http_ok "http://127.0.0.1:$FRONTEND_PORT/"; then
    ok "Frontend already running on port $FRONTEND_PORT"
else
    info "Starting frontend on port $FRONTEND_PORT..."
    nohup python3 -m http.server "$FRONTEND_PORT" --bind 127.0.0.1 \
        --directory "$PROJECT_ROOT/frontend" \
        >> "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
fi

# ── Wait for services ─────────────────────────────────────────
info "Waiting for backend..."
for i in $(seq 1 30); do
    if http_ok "http://127.0.0.1:$BACKEND_PORT/api/health"; then
        ok "Backend is ready"
        break
    fi
    [ "$i" -eq 30 ] && fail "Backend did not start within 30 seconds — see .logs/backend.log"
    sleep 1
done

info "Waiting for frontend..."
for i in $(seq 1 15); do
    if http_ok "http://127.0.0.1:$FRONTEND_PORT/"; then
        ok "Frontend is ready"
        break
    fi
    [ "$i" -eq 15 ] && fail "Frontend did not start within 15 seconds — see .logs/frontend.log"
    sleep 1
done

# ── Open browser ──────────────────────────────────────────────
URL="http://127.0.0.1:$FRONTEND_PORT"
ok "MatrixPro is running at $URL"

OS="$(uname -s)"
case "$OS" in
    Darwin) open "$URL" ;;
    Linux)  xdg-open "$URL" 2>/dev/null || sensible-browser "$URL" 2>/dev/null || warn "Open $URL in your browser" ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  ${GREEN}MatrixPro is running${NC}\n"
echo ""
echo "  Frontend:  http://127.0.0.1:$FRONTEND_PORT"
echo "  Backend:   http://127.0.0.1:$BACKEND_PORT"
echo "  Login:     admin@matrixpro.com / password123"
echo ""
echo "  Logs:      .logs/backend.log  .logs/frontend.log"
echo "  Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$BACKEND_PID" ] || [ -n "$FRONTEND_PID" ]; then
    wait
fi
