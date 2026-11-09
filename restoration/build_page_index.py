#!/usr/bin/env python3
"""Index supplied captured pages without altering any source files."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extracted"
OUTPUT = ROOT / "restoration" / "page-index.json"

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.in_title = False
        self.lang = ""
        self.canonical = ""
        self.description = ""
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "")
        elif tag == "title":
            self.in_title = True
        elif tag == "link" and a.get("rel", "").lower() == "canonical":
            self.canonical = a.get("href", "")
        elif tag == "meta" and a.get("name", "").lower() == "description":
            self.description = a.get("content", "")
    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
    def handle_data(self, data):
        if self.in_title:
            self.title += data

def main():
    if not SOURCE.is_dir():
        sys.exit("ERROR: extracted/ is missing")
    pages = []
    for path in sorted(list(SOURCE.glob("newvps*/cloned-page-*/index.html")) + list(SOURCE.glob("new-captures/**/cloned-page-*/index.html"))):
        parser = Metadata()
        parser.feed(path.read_text(encoding="utf-8", errors="replace"))
        url = parser.canonical
        parsed = urlsplit(url)
        issues = []
        if not url:
            issues.append("MISSING_CANONICAL")
        elif parsed.hostname not in ("anonport.com", "www.anonport.com"):
            issues.append("UNEXPECTED_CANONICAL_HOST")
        pages.append({
            "source": path.relative_to(ROOT).as_posix(),
            "archive": path.relative_to(SOURCE).parts[0],
            "capture": path.parent.name + ("-" + path.relative_to(SOURCE).parts[1] if path.relative_to(SOURCE).parts[0] == "new-captures" else ""),
            "canonical": url,
            "route": parsed.path or "/" if url else None,
            "language": parser.lang,
            "title": parser.title.strip(),
            "description": parser.description,
            "issues": issues
        })
    routes = {}
    for page in pages:
        if page["route"]:
            routes.setdefault(page["route"], []).append(page["source"])
    duplicates = {key: value for key, value in routes.items() if len(value) > 1}
    output = {
        "schema_version": 1,
        "source_count": len(pages),
        "unique_route_count": len(routes),
        "duplicate_routes": duplicates,
        "pages": pages
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Indexed {len(pages)} HTML captures; {len(routes)} distinct routes; {len(duplicates)} duplicate routes.")
    for page in pages:
        if page["issues"]:
            print(f"BLOCKER 02: {page['source']} {page['issues']}")
    if len(pages) < 69:
        sys.exit(f"BLOCKER 02: original 69 captures missing; found {len(pages)}")

if __name__ == "__main__":
    main()
