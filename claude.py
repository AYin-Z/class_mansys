import json
import os
import ssl
from urllib import request

import certifi

API_KEY = os.getenv(
    "ANTHROPIC_API_KEY",
    "sk-of-pNsNAufsVSGCYLUscufsJtrucURnGRzyENoStoxDhcKPQwljVavnnTpNFngrbqKy",
)
BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.ofox.ai/anthropic")
MODEL = os.getenv("ANTHROPIC_MODEL", "anthropic/claude-sonnet-4.6")
PROMPT = os.getenv("ANTHROPIC_PROMPT", "生命的意义是什么？")


def call_with_sdk() -> str:
    from anthropic import Anthropic  # type: ignore[import-not-found]

    client = Anthropic(api_key=API_KEY, base_url=BASE_URL)
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": PROMPT}],
    )
    return message.content[0].text


def call_with_http() -> str:
    payload = {
        "model": MODEL,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": PROMPT}],
    }
    req = request.Request(
        url=f"{BASE_URL.rstrip('/')}/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    with request.urlopen(req, timeout=60, context=ssl_ctx) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["content"][0]["text"]


def main() -> None:
    try:
        print(call_with_sdk())
    except ModuleNotFoundError:
        print(call_with_http())


if __name__ == "__main__":
    main()