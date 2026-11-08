#!/usr/bin/env python3
"""Verify every captured canonical route against the published GitHub Pages preview.

Read-only HTTP checks. Compare HTML title and language against original captures.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import quote
import json
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "restoration/page-index.json"
REPORT = ROOT / "restoration/online-route-audit.json"
BASE = os.environ.get("PREVIEW_URL", "https://jill0010.github.io/NewVPS").rstrip("/")

class PageMetadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.title_open = False
        self.lang = ""
    def handle_starttag(self, tag, attrs):
        if tag == "html":
            self.lang = dict(attrs).get("lang", "")
        if tag == "title":
            self.title_open = True
    def handle_endtag(self, tag):
        if tag == "title":
            self.title_open = False
    def handle_data(self, data):
        if self.title_open:
            self.title += data

def check(entry):
    route = entry["route"]
    url = BASE + ("/" if route == "/" else quote(route, safe="/") + ("" if route.endswith("/") else "/"))
    result = {"route": route, "url": url, "source": entry["source"], "status": None, "ok": False, "issues": []}
    try:
        with urlopen(Request(url, headers={"User-Agent": "NewVPS-original-route-audit/1.0"}), timeout=20) as response:
            result["status"] = response.status
            data = response.read(8 * 1024 * 1024).decode("utf-8", "replace")
        meta = PageMetadata()
        meta.feed(data)
        result["online_title"] = meta.title.strip()
        result["online_language"] = meta.lang
        if result["online_title"] != entry["title"]:
            result["issues"].append("TITLE_MISMATCH")
        if result["online_language"] != entry["language"]:
            result["issues"].append("LANGUAGE_MISMATCH")
        result["ok"] = result["status"] == 200 and not result["issues"]
    except HTTPError as exc:
        result["status"] = exc.code
        result["issues"].append("HTTP_ERROR")
    except (URLError, TimeoutError, OSError) as exc:
        result["issues"].append("NETWORK_ERROR")
        result["error"] = str(exc)[:300]
    return result

def main():
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    unique = {}
    for page in data["pages"]:
        unique.setdefault(page["route"], page)
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(check, unique.values()))
    report = {
        "preview_base_url": BASE,
        "total_routes": len(results),
        "passed": sum(r["ok"] for r in results),
        "failed": sum(not r["ok"] for r in results),
        "routes": results,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Online routes: {report['passed']}/{report['total_routes']} passed")
    for r in results:
        if not r["ok"]:
            print(f"ISSUE {r['route']} status={r['status']} {r['issues']}")
    if report["failed"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
