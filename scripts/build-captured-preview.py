#!/usr/bin/env python3
"""Build a static preview from archived HTML while keeping originals untouched.

Usage: python3 scripts/build-captured-preview.py
Output: dist-captured/ (deploy this directory as a separate preview, not production)
"""
from pathlib import Path
from urllib.parse import urlparse
from html.parser import HTMLParser
from html import escape
from urllib.parse import urlsplit, unquote
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

class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag in ("a", "form"):
            key = "href" if tag == "a" else "action"
            for name, value in attrs:
                if name == key and value:
                    self.links.append(value)


def main():
    if not INVENTORY.is_file():
        raise SystemExit("First generate reports/captured-route-inventory.csv")
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    with INVENTORY.open(encoding="utf-8", newline="") as f:
        entries = list(csv.DictReader(f))
    # Prefer the matching page collection over order-flow snapshots when
    # multiple captures claim the same canonical URL.
    # A checkout snapshot can carry /vps as canonical metadata.
    def capture_priority(entry):
        route = entry["route"]
        capture = entry["capture"].lower()
        if route in ("/vps", "/zh/vps"):
            return (1 if "order-pages" in capture else 0, capture)
        return (0 if "order-pages" not in capture else 1, capture)

    entries.sort(key=capture_priority)
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
        # Captured HTML contains live-site absolute paths and relative references.
        # Keep the original page markup; do not silently substitute fabricated content.
        # Remove browser-extension annotations captured by the archiver.
        html = re.sub(r'\sdata-immersive-translate-[\w-]+="[^"]*"', '', html)
        destination = OUT.joinpath(*parts, "index.html")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(html, encoding="utf-8")
        written[route] = entry["capture"]
    # Publish an additional byte-for-byte copy of each captured HTML and its
    # original asset directory. Unlike routed previews, these are not rewritten.
    # This is the authoritative comparison baseline for archive restoration.
    raw_count = 0
    seen_raw = set()
    for entry in entries:
        source = (ROOT / entry["capture"]).resolve()
        if not source.is_relative_to((ROOT / "extracted").resolve()) or not source.is_file():
            continue
        capture_id = source.parent.name
        if capture_id in seen_raw:
            continue
        seen_raw.add(capture_id)
        raw_dir = OUT / "original-captures" / capture_id
        raw_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, raw_dir / "index.html")
        assets = source.parent / "assets"
        if assets.is_dir():
            shutil.copytree(assets, raw_dir / "assets", dirs_exist_ok=True)
        raw_count += 1
    print(f"Preserved {raw_count} byte-identical original HTML captures under /original-captures/")
    # Preserve order captures even when their canonical URL duplicates the VPS catalog.
    order_count = 0
    for entry in entries:
        if "order-pages" not in entry["capture"].lower():
            continue
        source = (ROOT / entry["capture"]).resolve()
        if not source.is_relative_to((ROOT / "extracted").resolve()) or not source.is_file():
            continue
        capture_id = source.parent.name
        destination = OUT / "archived-order" / capture_id / "index.html"
        destination.parent.mkdir(parents=True, exist_ok=True)
        html = source.read_text(encoding="utf-8", errors="replace")
        # Apply the same boundary-aware rewrite as normal captured pages.
        # A global replace would corrupt already-absolute paths or script text.
        html = re.sub(r'(?<![\\w/])assets/', "/_captures/" + capture_id + "/assets/", html)
        html = re.sub(r'\\sdata-immersive-translate-[\\w-]+="[^"]*"', '', html)
        destination.write_text(html, encoding="utf-8")
        asset_source = source.parent / "assets"
        if asset_source.is_dir():
            shutil.copytree(asset_source, OUT / "_captures" / capture_id / "assets", dirs_exist_ok=True)
        order_count += 1
    print(f"Preserved {order_count} original order snapshots under /archived-order/")
    # Restore /order from an actual archived order capture, not from a
    # catalog page whose canonical URL happens to be /vps.
    # Query-specific checkout states remain static snapshots only.
    order_entries = [e for e in entries if "order-pages" in e["capture"].lower()]
    for language, route in (("en", "/order"), ("zh", "/zh/order")):
        candidates = []
        for entry in order_entries:
            report = ROOT / entry["capture"].replace("index.html", "capture-report.json")
            if not report.is_file():
                continue
            import json
            try:
                source_url = json.loads(report.read_text(encoding="utf-8")).get("sourceUrl", "")
            except (ValueError, OSError):
                continue
            source_path = urlsplit(source_url).path.rstrip("/") or "/"
            if source_path == route:
                candidates.append(entry)
        if not candidates:
            continue
        entry = candidates[0]
        source = ROOT / entry["capture"]
        capture_id = source.parent.name
        html = source.read_text(encoding="utf-8", errors="replace")
        html = re.sub(r'(?<![\\w/])assets/', "/_captures/" + capture_id + "/assets/", html)
        destination = OUT.joinpath(*safe_route(route), "index.html")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(html, encoding="utf-8")
        written[route] = entry["capture"]
        print(f"Restored archived checkout snapshot at {route} from {entry['capture']}")
    # Screenshot-based registration preview is separate from original captures.
    registration_preview = ROOT / "preview-pages" / "register" / "index.html"
    if registration_preview.is_file():
        registration_target = OUT / "register" / "index.html"
        registration_target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(registration_preview, registration_target)
        written["/register"] = registration_preview.relative_to(ROOT).as_posix()
    # Audit internal navigation against the routes actually generated.
    # Missing targets are reported without inventing pages or masking real 404s.
    known = set(written)
    missing_links = {}
    for route in known:
        page = OUT.joinpath(*safe_route(route), "index.html")
        parser = LinkCollector()
        parser.feed(page.read_text(encoding="utf-8", errors="replace"))
        for href in parser.links:
            parsed = urlsplit(href)
            if parsed.scheme and parsed.scheme not in ("http", "https"):
                continue
            if parsed.netloc and parsed.netloc.lower() not in ("anonport.com", "www.anonport.com"):
                continue
            if not href.startswith("/") and not parsed.netloc:
                continue
            target = unquote(parsed.path).rstrip("/") or "/"
            if target.startswith("/_captures/") or target.startswith("/assets/"):
                continue
            if "." in target.rsplit("/", 1)[-1]:
                continue
            if target not in known:
                missing_links.setdefault(target, set()).add(route)
    report = ROOT / "reports" / "captured-preview-missing-links.csv"
    report.parent.mkdir(exist_ok=True)
    with report.open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output)
        writer.writerow(("missing_route", "linked_from", "referring_pages"))
        for target, sources in sorted(missing_links.items()):
            writer.writerow((target, len(sources), " | ".join(sorted(sources)[:12])))
    # Publish the same audit beside the static preview for convenient review.
    shutil.copy2(report, OUT / "missing-routes.csv")
    print(f"Navigation audit: {len(missing_links)} unresolved internal routes -> {report}")
    print(f"Built {len(written)} static preview routes in {OUT}")
    print("This is a static archive preview. Login, registration, checkout and payments are NOT functional.")
    print("Do not deploy to production without validating interactive functionality.")

if __name__ == "__main__":
    main()
