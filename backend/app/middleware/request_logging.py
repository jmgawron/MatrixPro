"""
HTTP request logging middleware.

INFO: method, path, status, duration, authenticated user (when available).
DEBUG: query params and redacted JSON body for mutating requests.
"""

from __future__ import annotations

import json
import time
from typing import Any

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.logging_config import (
    get_logger,
    log_client_ip,
    log_user_email,
    log_user_id,
    redact_mapping,
)

logger = get_logger("middleware.request")

_SKIP_PATHS = frozenset({"/api/health", "/favicon.ico"})
_READ_BODY_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "-"


def _user_from_token(request: Request) -> tuple[str, str]:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return "-", "-"
    token = auth[7:].strip()
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=["HS256"]
        )
        sub = payload.get("sub")
        if sub is not None:
            return str(sub), "-"
    except jwt.PyJWTError:
        pass
    return "-", "-"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if path in _SKIP_PATHS:
            return await call_next(request)

        ip = _client_ip(request)
        uid, email = _user_from_token(request)
        token_uid = log_user_id.set(uid)
        token_email = log_user_email.set(email)
        token_ip = log_client_ip.set(ip)

        body_bytes: bytes | None = None
        if (
            request.method in _READ_BODY_METHODS
            and logger.isEnabledFor(10)  # DEBUG
            and path.startswith("/api/")
        ):
            body_bytes = await request.body()

            async def receive():
                return {"type": "http.request", "body": body_bytes or b"", "more_body": False}

            request = Request(request.scope, receive)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "request.error | %s %s | %.1fms",
                request.method,
                path,
                elapsed_ms,
            )
            raise
        else:
            elapsed_ms = (time.perf_counter() - start) * 1000
            status = response.status_code

            if path.startswith("/api/"):
                logger.info(
                    "request | %s %s | status=%s | %.1fms",
                    request.method,
                    path,
                    status,
                    elapsed_ms,
                )
                if body_bytes and logger.isEnabledFor(10):
                    _log_debug_body(request.method, path, body_bytes)

            return response
        finally:
            log_user_id.reset(token_uid)
            log_user_email.reset(token_email)
            log_client_ip.reset(token_ip)


def _log_debug_body(method: str, path: str, body_bytes: bytes) -> None:
    parsed: Any = None
    if body_bytes:
        try:
            parsed = json.loads(body_bytes.decode("utf-8"))
            if isinstance(parsed, dict):
                parsed = redact_mapping(parsed)
        except (UnicodeDecodeError, json.JSONDecodeError):
            parsed = "[non-json body]"
    logger.debug(
        "request.body | %s %s | payload=%s",
        method,
        path,
        parsed,
    )
