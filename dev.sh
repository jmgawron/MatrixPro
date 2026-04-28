#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# MatrixPro — Dev Control Script
# Usage: ./dev.sh start | stop | status | restart | logs
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ OK ]${NC}  %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
fail()  { printf "${RED}[ERR]${NC}  %s\n" "$*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
PID_DIR="$PROJECT_ROOT/.pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
LOG_DIR="$PROJECT_ROOT/.logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACKEND_PORT="${MATRIXPRO_BACKEND_PORT:-8000}"
FRONTEND_PORT="${MATRIXPRO_FRONTEND_PORT:-3000}"

mkdir -p "$PID_DIR" "$LOG_DIR"

is_running() {
    local pid_file="$1"
    [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

do_start() {
    # Preflight
    [ -d "$PROJECT_ROOT/backend/venv" ] || fail "Virtual environment not found. Run ./setup.sh first."
    [ -f "$PROJECT_ROOT/data/matrixpro.db" ] || fail "Database not found. Run ./setup.sh first."
    [ -f "$PROJECT_ROOT/.env" ] || fail ".env not found. Run ./setup.sh first."

    local venv_python="$PROJECT_ROOT/backend/venv/bin/python"

    if is_running "$BACKEND_PID_FILE"; then
        warn "Backend already running (PID $(cat "$BACKEND_PID_FILE"))"
    else
        info "Starting backend on port $BACKEND_PORT..."
        cd "$PROJECT_ROOT/backend"
        nohup "$venv_python" -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" \
            >> "$BACKEND_LOG" 2>&1 &
        disown
        echo $! > "$BACKEND_PID_FILE"
        cd "$PROJECT_ROOT"
        ok "Backend started (PID $(cat "$BACKEND_PID_FILE"))"
    fi

    if is_running "$FRONTEND_PID_FILE"; then
        warn "Frontend already running (PID $(cat "$FRONTEND_PID_FILE"))"
    else
        info "Starting frontend on port $FRONTEND_PORT..."
        nohup python3 -m http.server "$FRONTEND_PORT" --bind 0.0.0.0 \
            --directory "$PROJECT_ROOT/frontend" >> "$FRONTEND_LOG" 2>&1 &
        disown
        echo $! > "$FRONTEND_PID_FILE"
        ok "Frontend started (PID $(cat "$FRONTEND_PID_FILE"))"
    fi

    info "Waiting for backend..."
    local ready=0
    for i in $(seq 1 30); do
        if curl -sf "http://localhost:$BACKEND_PORT/api/health" &>/dev/null; then
            ready=1
            break
        fi
        sleep 1
    done
    if [ "$ready" -eq 1 ]; then
        ok "Backend is healthy"
    else
        warn "Backend not responding after 30s — check .logs/backend.log"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "  ${GREEN}MatrixPro is running${NC}\n"
    echo ""
    echo "  Frontend:  http://localhost:$FRONTEND_PORT"
    echo "  Backend:   http://localhost:$BACKEND_PORT"
    echo "  Login:     admin@matrixpro.com / password123"
    echo ""
    echo "  Stop with: ./dev.sh stop"
    echo "  Logs in:   .logs/"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Open browser on macOS
    if [ "$(uname -s)" = "Darwin" ]; then
        open "http://localhost:$FRONTEND_PORT"
    fi
}

do_stop() {
    local stopped=0

    if is_running "$BACKEND_PID_FILE"; then
        kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null
        rm -f "$BACKEND_PID_FILE"
        ok "Backend stopped"
        stopped=1
    fi

    if is_running "$FRONTEND_PID_FILE"; then
        kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null
        rm -f "$FRONTEND_PID_FILE"
        ok "Frontend stopped"
        stopped=1
    fi

    # Clean up stale PID files
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"

    [ "$stopped" -eq 0 ] && info "Nothing was running."
}

do_status() {
    if is_running "$BACKEND_PID_FILE"; then
        ok "Backend:  running (PID $(cat "$BACKEND_PID_FILE")) on port $BACKEND_PORT"
    else
        warn "Backend:  stopped"
        rm -f "$BACKEND_PID_FILE"
    fi

    if is_running "$FRONTEND_PID_FILE"; then
        ok "Frontend: running (PID $(cat "$FRONTEND_PID_FILE")) on port $FRONTEND_PORT"
    else
        warn "Frontend: stopped"
        rm -f "$FRONTEND_PID_FILE"
    fi
}

do_logs() {
    local target="${2:-all}"
    case "$target" in
        backend)  tail -f "$BACKEND_LOG" ;;
        frontend) tail -f "$FRONTEND_LOG" ;;
        *)        tail -f "$BACKEND_LOG" "$FRONTEND_LOG" ;;
    esac
}

# ── Main ──────────────────────────────────────────────────────
case "${1:-}" in
    start)   do_start ;;
    stop)    do_stop ;;
    status)  do_status ;;
    restart) do_stop; sleep 1; do_start ;;
    logs)    do_logs "$@" ;;
    *)
        echo "Usage: ./dev.sh {start|stop|status|restart|logs [backend|frontend]}"
        exit 1
        ;;
esac
