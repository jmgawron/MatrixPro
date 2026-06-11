"""Tests for application logging configuration."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.logging_config import (
    DailyRotatingFileHandler,
    _redact_text,
    redact_mapping,
    setup_logging,
)


def test_redact_mapping_masks_sensitive_keys():
    data = {
        "email": "bob@matrixpro.com",
        "password": "secret123",
        "access_token": "eyJhbGciOiJIUzI1NiJ9.abc.def",
        "nested": {"api_key": "sk-live-xyz"},
    }
    redacted = redact_mapping(data)
    assert redacted["email"] == "bob@matrixpro.com"
    assert redacted["password"] == "[REDACTED]"
    assert redacted["access_token"] == "[REDACTED]"
    assert redacted["nested"]["api_key"] == "[REDACTED]"


def test_redact_text_strips_bearer_tokens():
    raw = "Authorization: Bearer abc.def.ghi"
    assert "[REDACTED]" in _redact_text(raw)
    assert "abc.def.ghi" not in _redact_text(raw)


def test_setup_logging_debug_enables_file_handler(tmp_path):
    import app.logging_config as lc

    lc._CONFIGURED = False
    setup_logging(level="DEBUG", log_to_file=True, log_dir=tmp_path, retention_days=7)

    root = logging.getLogger()
    handler_types = {type(h).__name__ for h in root.handlers}
    assert "StreamHandler" in handler_types
    assert "DailyRotatingFileHandler" in handler_types

    logger = logging.getLogger("app.test")
    logger.info("test message")
    today = datetime.now(timezone.utc).date().isoformat()
    log_file = tmp_path / f"application-{today}.log"
    assert log_file.exists()
    content = log_file.read_text(encoding="utf-8")
    assert "test message" in content


def test_daily_rotating_file_handler_purges_old_files(tmp_path):
    handler = DailyRotatingFileHandler(tmp_path, retention_days=1)
    old_day = (datetime.now(timezone.utc).date() - timedelta(days=5)).isoformat()
    stale = tmp_path / f"application-{old_day}.log"
    stale.write_text("old", encoding="utf-8")

    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="fresh",
        args=(),
        exc_info=None,
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    handler.emit(record)
    handler.close()

    assert not stale.exists()
    today_file = tmp_path / f"application-{datetime.now(timezone.utc).date().isoformat()}.log"
    assert today_file.exists()
    assert "fresh" in today_file.read_text(encoding="utf-8")
