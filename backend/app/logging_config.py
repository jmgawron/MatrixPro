"""
Central logging configuration for MatrixPro.

Default (INFO): console output with timestamps, level, component, user, IP.
Debug mode: DEBUG to console + dated rotating files under logs/.

Sensitive fields (passwords, tokens, secrets) are redacted before emit.
"""

from __future__ import annotations

import logging
import re
import sys
from contextvars import ContextVar
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

# Request-scoped context populated by middleware / auth handlers.
log_user_id: ContextVar[str] = ContextVar("log_user_id", default="-")
log_user_email: ContextVar[str] = ContextVar("log_user_email", default="-")
log_client_ip: ContextVar[str] = ContextVar("log_client_ip", default="-")

_CONFIGURED = False

# Keys whose values must never appear in logs (case-insensitive).
_SENSITIVE_KEY_RE = re.compile(
    r"(password|passwd|secret|token|authorization|api[_-]?key|"
    r"access_token|refresh_token|jwt|credential|private[_-]?key)",
    re.IGNORECASE,
)

# Bearer tokens and JWT-shaped strings in free text.
_BEARER_RE = re.compile(r"Bearer\s+[A-Za-z0-9\-_\.=]+", re.IGNORECASE)
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+")

_LOG_FORMAT = (
    "%(asctime)s | %(levelname)-5s | %(name)s | "
    "user=%(log_user)s | ip=%(log_client_ip)s | %(message)s"
)
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S %Z"


class _ContextFilter(logging.Filter):
    """Inject user / IP context vars into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        uid = log_user_id.get("-")
        email = log_user_email.get("-")
        if email and email != "-":
            record.log_user = f"{email}({uid})" if uid != "-" else email
        elif uid != "-":
            record.log_user = uid
        else:
            record.log_user = "-"
        record.log_client_ip = log_client_ip.get("-")
        return True


class _RedactionFilter(logging.Filter):
    """Strip secrets from log message and structured args."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = _redact_text(record.msg)
        if record.args:
            record.args = tuple(
                _redact_value(a) if isinstance(a, (str, dict, list)) else a
                for a in record.args
            )
        return True


class DailyRotatingFileHandler(logging.Handler):
    """
    Append to logs/application-YYYY-MM-DD.log.
    Opens a new file automatically when the UTC date changes (midnight rotation).
    """

    def __init__(
        self,
        log_dir: Path,
        prefix: str = "application",
        retention_days: int = 30,
        encoding: str = "utf-8",
    ) -> None:
        super().__init__()
        self.log_dir = log_dir
        self.prefix = prefix
        self.retention_days = retention_days
        self.encoding = encoding
        self._current_date: date | None = None
        self._stream = None
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def _path_for(self, day: date) -> Path:
        return self.log_dir / f"{self.prefix}-{day.isoformat()}.log"

    def _ensure_stream(self) -> None:
        today = datetime.now(timezone.utc).date()
        if self._stream is not None and self._current_date == today:
            return
        if self._stream is not None:
            self._stream.close()
            self._stream = None
        self._current_date = today
        path = self._path_for(today)
        self._stream = open(path, "a", encoding=self.encoding)
        self._purge_old_files()

    def _purge_old_files(self) -> None:
        if self.retention_days <= 0:
            return
        cutoff = datetime.now(timezone.utc).date().toordinal() - self.retention_days
        for path in self.log_dir.glob(f"{self.prefix}-*.log"):
            try:
                # Filename: application-YYYY-MM-DD.log
                day_str = path.stem.replace(f"{self.prefix}-", "")
                file_day = date.fromisoformat(day_str)
                if file_day.toordinal() < cutoff:
                    path.unlink(missing_ok=True)
            except (ValueError, OSError):
                continue

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self._ensure_stream()
            assert self._stream is not None
            msg = self.format(record)
            self._stream.write(msg + "\n")
            self._stream.flush()
        except Exception:
            self.handleError(record)

    def close(self) -> None:
        if self._stream is not None:
            self._stream.close()
            self._stream = None
        super().close()


def _redact_text(text: Any) -> str:
    if text is None:
        return ""
    s = str(text)
    s = _BEARER_RE.sub("Bearer [REDACTED]", s)
    s = _JWT_RE.sub("[REDACTED_JWT]", s)
    return s


def _redact_value(value: Any) -> Any:
    if isinstance(value, str):
        return _redact_text(value)
    if isinstance(value, dict):
        return redact_mapping(value)
    if isinstance(value, list):
        return [_redact_value(v) for v in value]
    return value


def redact_mapping(data: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of *data* with sensitive keys masked."""
    out: dict[str, Any] = {}
    for key, val in data.items():
        if _SENSITIVE_KEY_RE.search(str(key)):
            out[key] = "[REDACTED]"
        elif isinstance(val, dict):
            out[key] = redact_mapping(val)
        elif isinstance(val, list):
            out[key] = [_redact_value(v) for v in val]
        elif isinstance(val, str):
            out[key] = _redact_text(val)
        else:
            out[key] = val
    return out


def setup_logging(
    *,
    level: str = "INFO",
    log_to_file: bool = False,
    log_dir: Path | None = None,
    retention_days: int = 30,
) -> None:
    """
    Configure application logging once.

    level: INFO (default) or DEBUG.
    log_to_file: when True, also write to logs/application-YYYY-MM-DD.log.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    numeric = getattr(logging, level.upper(), logging.INFO)
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(numeric)

    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT)
    formatter.converter = lambda *args: datetime.now(timezone.utc).timetuple()

    context_filter = _ContextFilter()
    redact_filter = _RedactionFilter()

    console = logging.StreamHandler(sys.stderr)
    console.setLevel(numeric)
    console.setFormatter(formatter)
    console.addFilter(context_filter)
    console.addFilter(redact_filter)
    root.addHandler(console)

    if log_to_file:
        directory = log_dir or (_project_logs_dir())
        file_handler = DailyRotatingFileHandler(
            directory, retention_days=retention_days
        )
        file_handler.setLevel(numeric)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(context_filter)
        file_handler.addFilter(redact_filter)
        root.addHandler(file_handler)

    # MatrixPro app loggers: INFO/DEBUG per mode; quiet noisy libraries at WARNING.
    logging.getLogger("app").setLevel(numeric)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)

    _CONFIGURED = True


def _project_logs_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "logs"


def get_logger(name: str) -> logging.Logger:
    """Return a logger under the app.* namespace."""
    if not name.startswith("app."):
        name = f"app.{name}"
    return logging.getLogger(name)


def configure_from_env() -> None:
    """Read MATRIXPRO_LOG_LEVEL / MATRIXPRO_LOG_FILE / MATRIXPRO_LOG_RETENTION_DAYS."""
    import os

    level = os.getenv("MATRIXPRO_LOG_LEVEL", "INFO")
    log_to_file = os.getenv("MATRIXPRO_LOG_FILE", "0").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    retention = int(os.getenv("MATRIXPRO_LOG_RETENTION_DAYS", "30"))
    log_dir_env = os.getenv("MATRIXPRO_LOG_DIR")
    log_dir = Path(log_dir_env) if log_dir_env else None
    setup_logging(
        level=level,
        log_to_file=log_to_file,
        log_dir=log_dir,
        retention_days=retention,
    )


def log_auth_event(
    logger: logging.Logger,
    event: str,
    *,
    email: str | None = None,
    user_id: int | None = None,
    success: bool = True,
    detail: str | None = None,
) -> None:
    parts = [f"auth.{event}"]
    if email:
        parts.append(f"email={email}")
    if user_id is not None:
        parts.append(f"user_id={user_id}")
    if detail:
        parts.append(detail)
    msg = " | ".join(parts)
    if success:
        logger.info(msg)
    else:
        logger.warning(msg)


def log_user_action(
    logger: logging.Logger,
    action: str,
    *,
    resource: str | None = None,
    detail: str | None = None,
    extra_data: dict[str, Any] | None = None,
) -> None:
    """High-level user action for INFO audit trail."""
    parts = [action]
    if resource:
        parts.append(f"resource={resource}")
    if detail:
        parts.append(detail)
    if extra_data:
        safe = redact_mapping(extra_data)
        parts.append(f"data={safe}")
    logger.info(" | ".join(parts))
