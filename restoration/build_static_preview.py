#!/usr/bin/env python3
"""Build an exact-content static preview from the user's original captured HTML.

Only rewrite relative captured asset URLs to their new immutable asset locations.
Never edit source captures. No synthetic pages or altered marketing copy.
"""
from pathlib import Path
import json
import re
import shutil
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "restoration" / "page-index.json"
OUT = ROOT / "site-preview"

def main():
    if not INDEX.exists():
        raise SystemExit("Run python3 restoration/build_page_index.py first")
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    seen = {}
    conflicts = []
    for page in data["pages"]:
        source = ROOT / page["source"]
        route = page["route"]
        if not route or not route.startswith("/") or ".." in Path(route).parts:
            conflicts.append({"source": page["source"], "reason": "INVALID_ROUTE"})
            continue
        if route in seen:
            conflicts.append({"source": page["source"], "route": route, "reason": "DUPLICATE_ROUTE", "previous": seen[route]})
            continue
        seen[route] = page["source"]
        capture = page["capture"]
        asset_src = source.parent / "assets"
        asset_dst = OUT / "_captures" / capture / "assets"
        if asset_src.exists():
            shutil.copytree(asset_src, asset_dst)
        html = source.read_text(encoding="utf-8", errors="replace")
        # Keep all original HTML intact except captured relative asset references.
        html = re.sub(r'(?<=["\x27])assets/', f'/_captures/{capture}/assets/', html)
        # URL routes are represented by directory index files for static hosts.
        target = OUT / route.lstrip("/") / "index.html" if route != "/" else OUT / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")
    (OUT / ".nojekyll").write_text("")
    report = {"captures": len(data["pages"]), "published_routes": len(seen), "conflicts": conflicts,
              "note": "Preview contains only supplied snapshots; backend functionality not reproduced."}
    (OUT / "restoration-build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not seen:
        raise SystemExit("No routes published")

if __name__ == "__main__":
    main()
