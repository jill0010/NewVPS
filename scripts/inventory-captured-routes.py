#!/usr/bin/env python3
"""Inventory archived AnonPort pages without modifying the original captures."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
import csv
import sys

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "extracted"
OUTPUT = ROOT / "reports" / "captured-route-inventory.csv"

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = ""
        self.title = ""
        self.lang = ""
        self.in_title = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href", "")
        if tag == "title":
            self.in_title = True
    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
    def handle_data(self, data):
        if self.in_title:
            self.title += data

def main():
    if not CAPTURES.exists():
        sys.exit("Missing extracted/ directory")
    rows = []
    for path in sorted(CAPTURES.rglob("index.html")):
        parser = PageParser()
        try:
            parser.feed(path.read_text(encoding="utf-8", errors="replace"))
        except Exception as exc:
            print(f"Cannot parse {path}: {exc}", file=sys.stderr)
            continue
        parsed = urlparse(parser.canonical)
        route = parsed.path or ""
        rows.append({
            "route": route,
            "language": parser.lang,
            "title": parser.title.strip(),
            "canonical": parser.canonical,
            "capture": path.relative_to(ROOT).as_posix(),
            "status": "needs-route-verification" if route else "missing-canonical",
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["route","language","title","canonical","capture","status"])
        writer.writeheader()
        writer.writerows(rows)
    routes = {r["route"] for r in rows if r["route"]}
    print(f"Indexed {len(rows)} HTML captures, {len(routes)} distinct canonical paths -> {OUTPUT.relative_to(ROOT)}")
    print("Note: canonical paths are metadata, not proof of live route availability.")

if __name__ == "__main__":
    main()
