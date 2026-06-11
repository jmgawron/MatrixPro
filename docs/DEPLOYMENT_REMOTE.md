# Remote Deployment — 10.62.186.130

**Last deployed:** 2026-06-07 (UTC)  
**Method:** Native nginx + uvicorn (no Docker on host)

## Host

| Item | Value |
|------|-------|
| URL | http://10.62.186.130/ |
| OS | Ubuntu 25.04 (krk-ubuntu25) |
| SSH user | `cisco` |
| App path | `/home/cisco/MatrixPro` |
| Previous backup | `/home/cisco/MatrixPro.old-20260607-174402` |

## Architecture

```
Browser → nginx :80 (www-data)
              ├─ /        → /home/cisco/MatrixPro/frontend (static SPA)
              └─ /api/    → proxy → uvicorn 127.0.0.1:8000
```

- **Nginx config:** `/etc/nginx/sites-enabled/` (default server, unchanged during deploy)
- **Backend:** `~/MatrixPro/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`
- **Database:** `~/MatrixPro/data/matrixpro.db` (fresh seed on 2026-06-07 deploy)
- **Logs:** `~/MatrixPro/.logs/backend.log`
- **PID file:** `~/MatrixPro/.pids/backend.pid`

## Deploy procedure (from developer workstation)

1. Stop old backend: `pkill -f "uvicorn app.main:app"`
2. Backup current tree: `mv ~/MatrixPro ~/MatrixPro.old-$(date -u +%Y%m%d-%H%M%S)`
3. Rsync project (exclude venv, data, caches) to `~/MatrixPro/`
4. Create `.env` (JWT secret, CORS for host IP, corporate HTTP(S)_PROXY)
5. `python3 -m venv venv && pip install -r requirements.txt && python -m app.seed`
6. Start uvicorn in background (see above)

Credentials for SSH are stored outside the repo (not committed).

## Demo logins (seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@matrixpro.com | password123 |
| Manager | mgr-lansw@matrixpro.com | password123 |
| Engineer | bob@matrixpro.com | password123 |

(LANSW Shift-2 demo data: alice/bob/caden/daniela/ethan/fiona/grace @matrixpro.com)

## Verification

```bash
curl http://10.62.186.130/api/health
# {"status":"ok","service":"MatrixPro API"}

curl http://10.62.186.130/api/stats
```

## Notes

- Host has no Docker; deployment matches historical native pattern.
- Corporate proxy (`proxy.esl.cisco.com:80`) required for `pip` during setup.
- PDF export (WeasyPrint) system libraries were already present from prior installs.
- To restart backend only:

```bash
cd ~/MatrixPro/backend
source venv/bin/activate
pkill -f "uvicorn app.main:app" || true
nohup venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 >> ../.logs/backend.log 2>&1 &
```
