"""Paths and settings. Reads the project-root .env (no external dependency)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"
RAW_DIR = ROOT / "data" / "raw"
REPORT_DIR = ROOT / "data" / "reports"

EFK_BASE = "https://politikfinanzierung.efk.admin.ch/api/frontend/v1"
LANGS = ("fr", "de", "it")
REQUESTS_PER_SECOND = 3.0


def _load_env() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env()

# Identify the scraper to the EFK; set SCRAPER_CONTACT in .env (kept out of the public repo).
USER_AGENT = f"CHpoliticalfinance/0.1 (civic data project; contact: {os.environ.get('SCRAPER_CONTACT', 'see project repository')})"


def db_params() -> dict:
    return dict(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", "3306")),
        database=os.environ.get("DB_NAME", "chpf"),
        user=os.environ["DB_ETL_USER"],
        password=os.environ["DB_ETL_PASSWORD"],
    )
