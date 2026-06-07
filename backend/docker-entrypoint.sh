#!/bin/sh
set -e

python - <<'PY'
from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
try:
    if db.query(User).count() == 0:
        print("Empty database detected — running seed...")
        import subprocess
        subprocess.run(["python", "-m", "app.seed"], check=True)
finally:
    db.close()
PY

exec uvicorn app.main:app --host 0.0.0.0 --port 5000
