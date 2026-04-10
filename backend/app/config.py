import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (two levels up from this file)
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / ".env")

# Default SQLite path: use /data/ in Docker, or ./data/ locally
_default_db_dir = Path("/data") if Path("/data").exists() else _project_root / "data"
_default_db_dir.mkdir(parents=True, exist_ok=True)
_default_db_url = f"sqlite:///{_default_db_dir / 'matrixpro.db'}"


class Settings:
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    DATABASE_URL: str = os.getenv("DATABASE_URL", _default_db_url)
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))


settings = Settings()
