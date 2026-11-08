#!/usr/bin/env python3
"""Audit captured local assets; distinguish navigation links from asset dependencies."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "restoration/page-index.json"
OUTPUT = ROOT / "restoration/asset-issues.json"
EXTENSIONS = {".css", ".js", ".mjs", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".json", ".webmanifest", ".mp4", ".webm"}

class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("src", "href", "poster"):
            if key in a:
                self.refs.append((tag, key, a[key]))
        for key in ("srcset",):
            if key in a:
                self.refs.extend((tag, key, x.strip().split()[0]) for x in a[key].split(",") if x.strip())

def main():
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    missing = []
    navigational_asset_links = []
    checked = 0
    external = 0
    skipped_navigation = 0
    for page in data["pages"]:
        source = ROOT / page["source"]
        parser = Refs()
        parser.feed(source.read_text(encoding="utf-8", errors="replace"))
        for tag, attribute, ref in parser.refs:
            if not ref or ref.startswith(("data:", "mailto:", "tel:", "javascript:", "#")):
                continue
            u = urlsplit(ref)
            if u.scheme or u.netloc:
                external += 1
                continue
            path = unquote(u.path)
            if not path:
                continue
            suffix = Path(path).suffix.lower()
            if suffix not in EXTENSIONS:
                skipped_navigation += 1
                continue
            # Anchor links to asset-like paths are downloads/navigation, not rendering dependencies.
            if tag == "a" and attribute == "href":
                navigational_asset_links.append({"source": page["source"], "reference": ref})
                continue
            # Absolute /favicon.ico etc are separate from captured assets/.
            if path.startswith("/"):
                target = source.parent / path.lstrip("/")
                if not target.exists():
                    alternatives = list((source.parent / "assets").rglob(Path(path).name))
                    if alternatives:
                        continue
            else:
                target = source.parent / path
            checked += 1
            if not target.is_file():
                missing.append({"source": page["source"], "reference": ref, "tag": tag, "attribute": attribute})
    OUTPUT.write_text(json.dumps({
        "schema_version": 2,
        "checked_local_asset_references": checked,
        "external_references": external,
        "skipped_navigation_references": skipped_navigation,
        "count": len(missing),
        "navigational_asset_links": navigational_asset_links,
        "issues": missing
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Checked {checked} local asset references; missing {len(missing)}; navigation skipped {skipped_navigation}; external {external}")

if __name__ == "__main__":
    main()
