#!/usr/bin/env python3
"""Build a static preview from archived HTML while keeping originals untouched.

Usage: python3 scripts/build-captured-preview.py
Output: dist-captured/ (deploy this directory as a separate preview, not production)
"""
from pathlib import Path
from urllib.parse import urlparse
from html.parser import HTMLParser
import csv
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "reports/captured-route-inventory.csv"
OUT = ROOT / "dist-captured"

def safe_route(route):
    if not route.startswith("/") or "\\" in route or "//" in route:
        return None
    parts = route.strip("/").split("/") if route != "/" else []
    if any(part in (".", "..") for part in parts):
        return None
    return parts

def main():
    if not INVENTORY.is_file():
        raise SystemExit("First generate reports/captured-route-inventory.csv")
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    with INVENTORY.open(encoding="utf-8", newline="") as f:
        entries = list(csv.DictReader(f))
    written = {}
    for entry in entries:
        route = entry["route"]
        parts = safe_route(route)
        if parts is None or route in written:
            continue
        source = (ROOT / entry["capture"]).resolve()
        if not source.is_relative_to((ROOT / "extracted").resolve()) or not source.is_file():
            continue
        capture_id = source.parent.name
        # Namespace assets by capture to prevent CSS, flag and background collisions.
        prefix = "/_captures/" + capture_id + "/assets/"
        asset_source = source.parent / "assets"
        asset_dest = OUT / "_captures" / capture_id / "assets"
        if asset_source.is_dir():
            shutil.copytree(asset_source, asset_dest, dirs_exist_ok=True)
        html = source.read_text(encoding="utf-8", errors="replace")
        # Rewrite only captured relative asset references, including inline CSS URLs.
        html = re.sub(r'(?<![\w/])assets/', prefix, html)
        # Remove browser-extension annotations captured by the archiver.
        html = re.sub(r'\sdata-immersive-translate-[\w-]+="[^"]*"', '', html)
        destination = OUT.joinpath(*parts, "index.html")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(html, encoding="utf-8")
        written[route] = entry["capture"]
    print(f"Built {len(written)} static preview routes in {OUT}")
    print("This is a static archive preview. Login, registration, checkout and payments are NOT functional.")
    print("Do not deploy to production without validating interactive functionality.")

if __name__ == "__main__":
    main()
