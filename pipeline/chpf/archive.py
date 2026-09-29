"""Append-only raw archive of fetched payloads.

Layout:
  data/raw/payloads/<lang>/<path>/<checksum>.<ext>  body (json, or csv for Swissvotes), never modified
  data/raw/index.jsonl                              one line per fetch: url, lang, path, checksum, file, fetched_at

The index (not the DB) is the source of truth for `pipeline rebuild`.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from . import settings


def _safe(path: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-/]", "_", path.replace("?", "/").replace("=", "-"))


@dataclass
class Entry:
    lang: str
    path: str
    checksum: str
    file: str
    fetched_at: str


class Archive:
    def __init__(self, root: Path = settings.RAW_DIR):
        self.root = root
        self.index_file = root / "index.jsonl"
        self._latest: dict[tuple[str, str], Entry] = {}
        if self.index_file.exists():
            with self.index_file.open() as fh:
                for line in fh:
                    if line.strip():
                        e = Entry(**json.loads(line))
                        self._latest[(e.lang, e.path)] = e

    def latest(self, lang: str, path: str) -> Entry | None:
        return self._latest.get((lang, path))

    def store(self, lang: str, path: str, checksum: str, body: bytes, ext: str = "json") -> tuple[Entry, bool]:
        """Store a body; returns (entry, changed) where changed = content differs from the latest one."""
        prev = self.latest(lang, path)
        rel = Path("payloads") / lang / _safe(path) / f"{checksum}.{ext}"
        target = self.root / rel
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(body)
        entry = Entry(lang, path, checksum, str(rel), datetime.now(timezone.utc).isoformat(timespec="seconds"))
        self.index_file.parent.mkdir(parents=True, exist_ok=True)
        with self.index_file.open("a") as fh:
            fh.write(json.dumps(entry.__dict__) + "\n")
        self._latest[(lang, path)] = entry
        return entry, (prev is None or prev.checksum != checksum)

    def load(self, lang: str, path: str) -> dict | None:
        e = self.latest(lang, path)
        if e is None:
            return None
        return json.loads((self.root / e.file).read_text())

    def load_bytes(self, lang: str, path: str) -> bytes | None:
        e = self.latest(lang, path)
        return None if e is None else (self.root / e.file).read_bytes()

    def entries(self):
        return self._latest.values()
