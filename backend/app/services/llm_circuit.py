"""Cisco BridgeIT (Circuit) LLM client wrapper.

Reuses the OAuth2 + chat-completion mechanism from CircuIT_Chat/chat.py so that
MatrixPro speaks to the same internal Cisco LLM endpoint with the same auth
flow. Credentials are hard-coded per user instruction; env vars may override.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Iterable

import requests

logger = logging.getLogger(__name__)

# ─── Hard-coded credentials (env overrides allowed) ────────────────────────────
_DEFAULT_CLIENT_ID = "0oar0ze5srPQkAONJ5d7"
_DEFAULT_CLIENT_SECRET = "TavCgSqQNrBfX4Xy1mGelT1y6QBuRa_ozaQGL5QwRgEIcD4a205oL4d6nkSyaV2n"
_DEFAULT_APPKEY = "egai-prd-cx-541054562-summarize-1760527225824"

CIRCUIT_CLIENT_ID = os.environ.get("CIRCUIT_CLIENT_ID", _DEFAULT_CLIENT_ID)
CIRCUIT_CLIENT_SECRET = os.environ.get("CIRCUIT_CLIENT_SECRET", _DEFAULT_CLIENT_SECRET)
CIRCUIT_APPKEY = os.environ.get("CIRCUIT_APPKEY", _DEFAULT_APPKEY)

_TOKEN_URL = "https://id.cisco.com/oauth2/default/v1/token"
_CHAT_URL = (
    "https://chat-ai.cisco.com/openai/deployments/gemini-3.1-flash-lite/chat/completions"
)
_TIMEOUT = 250


class LLMError(RuntimeError):
    """Raised when the upstream LLM call fails."""


def get_token() -> str:
    """Obtain an OAuth2 access token via client_credentials grant."""
    creds = f"{CIRCUIT_CLIENT_ID}:{CIRCUIT_CLIENT_SECRET}".encode("utf-8")
    basic = base64.b64encode(creds).decode("utf-8")
    headers = {
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {basic}",
    }
    try:
        resp = requests.post(
            _TOKEN_URL,
            headers=headers,
            data="grant_type=client_credentials",
            timeout=30,
        )
    except requests.RequestException as exc:
        raise LLMError(f"Token request failed: {exc}") from exc

    if resp.status_code != 200:
        raise LLMError(
            f"Token endpoint returned {resp.status_code}: {resp.text[:200]}"
        )

    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise LLMError("Token response missing access_token")
    return token


def chat_completion(messages: Iterable[dict]) -> str:
    """Send chat messages to BridgeIT and return the assistant text content."""
    token = get_token()
    payload = {
        "messages": list(messages),
        "user": json.dumps({"appkey": CIRCUIT_APPKEY}),
        "stop": ["<|im_end|>"],
    }
    try:
        resp = requests.post(
            _CHAT_URL,
            data=json.dumps(payload, ensure_ascii=False),
            headers={
                "Content-Type": "application/json",
                "accept": "application/json",
                "api-key": token,
            },
            timeout=_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise LLMError(f"Chat request failed: {exc}") from exc

    if resp.status_code != 200:
        raise LLMError(
            f"Chat endpoint returned {resp.status_code}: {resp.text[:300]}"
        )

    body = resp.json()
    choices = body.get("choices") or []
    if not choices:
        raise LLMError(f"No choices in LLM response: {body}")
    content = choices[0].get("message", {}).get("content")
    if not content:
        raise LLMError("Empty content in LLM response")
    return content
