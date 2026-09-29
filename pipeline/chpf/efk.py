"""HTTP client for the (undocumented) EFK frontend API. See docs/01-data-sources.md."""
from __future__ import annotations

import hashlib
import json
import time

import httpx

from . import settings


class EfkError(RuntimeError):
    pass


class EfkClient:
    def __init__(self, rps: float = settings.REQUESTS_PER_SECOND, retries: int = 4):
        self._http = httpx.Client(
            base_url=settings.EFK_BASE,
            headers={"User-Agent": settings.USER_AGENT, "Accept": "application/json"},
            timeout=60,
            follow_redirects=True,
        )
        self._min_interval = 1.0 / rps
        self._last = 0.0
        self._retries = retries
        self.request_count = 0

    def close(self) -> None:
        self._http.close()

    def _throttle(self) -> None:
        wait = self._last + self._min_interval - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()

    def get_json(self, lang: str, path: str) -> tuple[dict, str, bytes]:
        """Return (payload, checksum, raw body). Checksum = meta.data_checksum_sha256 or sha256(body)."""
        url = f"/{lang}/{path}"
        for attempt in range(self._retries + 1):
            self._throttle()
            self.request_count += 1
            try:
                r = self._http.get(url)
            except httpx.HTTPError as e:
                err = str(e)
            else:
                if r.status_code == 200:
                    try:
                        payload = r.json()
                    except json.JSONDecodeError as e:
                        raise EfkError(f"{url}: not JSON ({e})") from e
                    if "data" not in payload:
                        raise EfkError(f"{url}: unexpected shape, keys={list(payload)}")
                    checksum = (payload.get("meta") or {}).get("data_checksum_sha256") \
                        or hashlib.sha256(r.content).hexdigest()
                    return payload, checksum, r.content
                if r.status_code not in (429, 500, 502, 503, 504):
                    raise EfkError(f"{url}: HTTP {r.status_code}")
                err = f"HTTP {r.status_code}"
            time.sleep(min(60, 2 ** attempt * 2))
        raise EfkError(f"{url}: giving up after retries ({err})")
