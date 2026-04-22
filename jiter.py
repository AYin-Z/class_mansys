import json
from typing import Any


def from_json(data: bytes | bytearray | str, partial_mode: str | None = None) -> Any:
    if isinstance(data, (bytes, bytearray)):
        text = data.decode("utf-8", errors="ignore")
    else:
        text = data

    if partial_mode == "trailing-strings":
        # Compatible fallback: parse longest valid JSON prefix.
        for end in range(len(text), 0, -1):
            try:
                return json.loads(text[:end])
            except json.JSONDecodeError:
                continue

    return json.loads(text)
