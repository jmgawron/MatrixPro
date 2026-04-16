#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# MatrixPro — Environment Setup Script
# Supports macOS (Homebrew) and Linux (apt / dnf / pacman)
# Run once after cloning the repository.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
fail()  { printf "${RED}[ERROR]${NC} %s\n" "$*"; exit 1; }

# ── Locate project root (directory containing this script) ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"
info "Project root: $PROJECT_ROOT"

# ── Detect OS ────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
    Darwin) PLATFORM="macos" ;;
    Linux)  PLATFORM="linux" ;;
    *)      fail "Unsupported OS: $OS. This script supports macOS and Linux." ;;
esac
info "Detected platform: $PLATFORM"

# ── Detect Linux package manager ─────────────────────────────
detect_linux_pkg_manager() {
    if command -v apt-get &>/dev/null; then echo "apt"
    elif command -v dnf &>/dev/null; then echo "dnf"
    elif command -v pacman &>/dev/null; then echo "pacman"
    else echo "unknown"
    fi
}

# ── Install system dependencies ──────────────────────────────
install_system_deps() {
    info "Installing system dependencies..."

    if [ "$PLATFORM" = "macos" ]; then
        if ! command -v brew &>/dev/null; then
            fail "Homebrew is required but not installed.\nInstall it: https://brew.sh"
        fi
        # Python 3.11+, plus WeasyPrint deps (pango, cairo, libffi)
        brew install python@3.11 pango cairo libffi gobject-introspection 2>/dev/null || true
        ok "macOS dependencies installed via Homebrew"

    elif [ "$PLATFORM" = "linux" ]; then
        PKG_MGR=$(detect_linux_pkg_manager)
        case "$PKG_MGR" in
            apt)
                info "Using apt (Debian/Ubuntu)"
                sudo apt-get update -qq
                sudo apt-get install -y -qq \
                    python3 python3-venv python3-pip python3-dev \
                    libpango1.0-dev libcairo2-dev libffi-dev \
                    libgdk-pixbuf-2.0-dev || sudo apt-get install -y -qq libgdk-pixbuf-xlib-2.0-dev || true
                sudo apt-get install -y -qq \
                    libxml2-dev libxslt1-dev shared-mime-info \
                    curl
                ;;
            dnf)
                info "Using dnf (Fedora/RHEL)"
                sudo dnf install -y \
                    python3 python3-devel python3-pip \
                    pango-devel cairo-devel libffi-devel gdk-pixbuf2-devel \
                    libxml2-devel libxslt-devel shared-mime-info \
                    curl
                ;;
            pacman)
                info "Using pacman (Arch)"
                sudo pacman -Sy --noconfirm \
                    python python-pip \
                    pango cairo libffi gdk-pixbuf2 \
                    libxml2 libxslt shared-mime-info \
                    curl
                ;;
            *)
                warn "Unknown package manager. Please install manually:"
                warn "  Python 3.11+, pip, venv, pango, cairo, libffi"
                warn "Continuing — pip install may fail for WeasyPrint without system libs."
                ;;
        esac
        ok "Linux dependencies installed"
    fi
}

# ── Check Python version ─────────────────────────────────────
check_python() {
    # Try python3.11 first, then python3, then python
    for cmd in python3.11 python3 python; do
        if command -v "$cmd" &>/dev/null; then
            PY_VERSION=$("$cmd" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
            PY_MAJOR=$("$cmd" -c 'import sys; print(sys.version_info.major)')
            PY_MINOR=$("$cmd" -c 'import sys; print(sys.version_info.minor)')
            if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 11 ]; then
                PYTHON="$cmd"
                ok "Python $PY_VERSION found ($PYTHON)"
                return 0
            fi
        fi
    done
    fail "Python 3.11+ is required but not found. Please install Python 3.11 or later."
}

# ── Create .env ──────────────────────────────────────────────
setup_env() {
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        info "Creating .env from .env.example..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        # Generate a random JWT secret
        JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48 || true)
        if [ -n "$JWT_SECRET" ]; then
            if [ "$PLATFORM" = "macos" ]; then
                sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$PROJECT_ROOT/.env"
            else
                sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$PROJECT_ROOT/.env"
            fi
            ok ".env created with random JWT_SECRET"
        else
            warn ".env created but could not generate random secret. Edit JWT_SECRET manually."
        fi
    else
        ok ".env already exists — skipping"
    fi
}

# ── Set up Python virtual environment ────────────────────────
setup_venv() {
    info "Setting up Python virtual environment..."
    cd "$PROJECT_ROOT/backend"

    if [ ! -d "venv" ]; then
        "$PYTHON" -m venv venv
        ok "Virtual environment created"
    else
        ok "Virtual environment already exists"
    fi

    # Activate
    source venv/bin/activate

    # Upgrade pip
    pip install --upgrade pip --quiet
    ok "pip upgraded"

    # Install dependencies
    info "Installing Python dependencies (this may take a minute)..."
    pip install -r requirements.txt --quiet
    ok "Python dependencies installed"

    cd "$PROJECT_ROOT"
}

# ── Create data directory & seed database ────────────────────
setup_database() {
    info "Setting up database..."
    mkdir -p "$PROJECT_ROOT/data"

    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate

    # Remove old DB if it exists (seed creates a fresh one)
    if [ -f "$PROJECT_ROOT/data/matrixpro.db" ]; then
        warn "Existing database found — removing for a clean seed"
        rm "$PROJECT_ROOT/data/matrixpro.db"
    fi

    "$PYTHON" -m app.seed
    ok "Database seeded with demo data"

    cd "$PROJECT_ROOT"
}

# ── Print summary ────────────────────────────────────────────
print_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "${GREEN} ✓  MatrixPro setup complete!${NC}\n"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  To start the application, run:"
    echo ""
    printf "    ${CYAN}./start.sh${NC}\n"
    echo ""
    echo "  Or start manually:"
    echo ""
    echo "    # Terminal 1 — Backend"
    echo "    cd backend && source venv/bin/activate"
    echo "    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    echo ""
    echo "    # Terminal 2 — Frontend"
    echo "    cd frontend && python3 -m http.server 3000"
    echo ""
    echo "    Then open: http://localhost:3000"
    echo ""
    echo "  Demo login:  admin@matrixpro.com / password123"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║          MatrixPro — Environment Setup            ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""

    install_system_deps
    check_python
    setup_env
    setup_venv
    setup_database
    print_summary
}

main "$@"
