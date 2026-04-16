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

# ── Start backend ─────────────────────────────────────────────
info "Starting backend on port $BACKEND_PORT..."
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# ── Start frontend ────────────────────────────────────────────
info "Starting frontend on port $FRONTEND_PORT..."
cd "$PROJECT_ROOT/frontend"
python3 -m http.server "$FRONTEND_PORT" --bind 0.0.0.0 &>/dev/null &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"

# ── Wait for backend to be ready ──────────────────────────────
info "Waiting for backend..."
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$BACKEND_PORT/api/health" &>/dev/null; then
        ok "Backend is ready"
        break
    fi
    [ "$i" -eq 30 ] && fail "Backend did not start within 30 seconds"
    sleep 1
done

# ── Open browser ──────────────────────────────────────────────
URL="http://localhost:$FRONTEND_PORT"
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
echo "  Frontend:  http://localhost:$FRONTEND_PORT"
echo "  Backend:   http://localhost:$BACKEND_PORT"
echo "  Login:     admin@matrixpro.com / password123"
echo ""
echo "  Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait
