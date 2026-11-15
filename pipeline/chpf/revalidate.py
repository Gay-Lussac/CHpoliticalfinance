"""Conditional downloads: remember each URL's ETag / Last-Modified and send it back next time, so a source that has
not changed answers 304 "not modified" with no body. Kept in data/raw/validators.json, next to the archive.

A validator is only sent when the archive still holds a copy of that file: a fresh or partial archive always gets
full downloads, never a 304 it could not serve from.
"""
from __future__ import annotations

import json
import os
import tempfile

from . import settings

FILE = settings.RAW_DIR / "validators.json"


class Validators:
    def __init__(self):
        try:
            self._data = json.loads(FILE.read_text())
        except (OSError, ValueError):
            self._data = {}
        self._dirty = False

    def headers(self, key: str, have_copy: bool) -> dict:
        """Request headers for a conditional GET (empty when we have no copy or no validator)."""
        v = self._data.get(key) if have_copy else None
        if not v:
            return {}
        h = {}
        if v.get("etag"):
            # Apache's compression appends "-gzip" to the ETag it sends but does not recognise it coming back
            # (the EFK server does this): send the original tag.
            h["If-None-Match"] = v["etag"].replace('-gzip"', '"').replace(';gzip"', '"')
        if v.get("last_modified"):
            h["If-Modified-Since"] = v["last_modified"]
        return h

    def remember(self, key: str, response) -> None:
        etag, last = response.headers.get("etag"), response.headers.get("last-modified")
        if etag or last:
            self._data[key] = {"etag": etag, "last_modified": last}
            self._dirty = True

    def save(self) -> None:
        if not self._dirty:
            return
        FILE.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=FILE.parent, prefix=".validators.")
        with os.fdopen(fd, "w") as fh:
            json.dump(self._data, fh, indent=0, sort_keys=True)
        os.replace(tmp, FILE)                     # atomic: a crash never leaves a half-written file
        self._dirty = False
