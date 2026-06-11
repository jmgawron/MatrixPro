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


_INSECURE_JWT_SECRETS = frozenset(
    {"", "change-me", "change-me-in-production", "changeme", "secret"}
)


class Settings:
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    DATABASE_URL: str = os.getenv("DATABASE_URL", _default_db_url)
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
    ENV: str = os.getenv("MATRIXPRO_ENV", "development")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:8000,http://127.0.0.1:8000",
        ).split(",")
        if origin.strip()
    ]
    LOG_LEVEL: str = os.getenv("MATRIXPRO_LOG_LEVEL", "INFO")
    LOG_TO_FILE: bool = os.getenv("MATRIXPRO_LOG_FILE", "0").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    LOG_DIR: str = os.getenv("MATRIXPRO_LOG_DIR", str(_project_root / "logs"))
    LOG_RETENTION_DAYS: int = int(os.getenv("MATRIXPRO_LOG_RETENTION_DAYS", "30"))

    def validate(self) -> None:
        if self.ENV.lower() in ("production", "prod"):
            if (
                self.JWT_SECRET in _INSECURE_JWT_SECRETS
                or len(self.JWT_SECRET) < 32
            ):
                raise RuntimeError(
                    "JWT_SECRET must be a strong value (≥32 chars) when "
                    "MATRIXPRO_ENV=production"
                )


settings = Settings()
