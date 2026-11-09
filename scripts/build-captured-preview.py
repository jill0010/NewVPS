#!/usr/bin/env python3
"""Build a static preview from archived HTML while keeping originals untouched.

Usage: python3 scripts/build-captured-preview.py
Output: dist-captured/ (deploy this directory as a separate preview, not production)
"""
from pathlib import Path
from urllib.parse import urlparse
from html.parser import HTMLParser
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
        # Remove browser-extension annotations captured by the archiver.
        html = re.sub(r'\sdata-immersive-translate-[\w-]+="[^"]*"', '', html)
        destination = OUT.joinpath(*parts, "index.html")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(html, encoding="utf-8")
        written[route] = entry["capture"]
    # The archived dataset does not contain the site's root homepage.
    # Provide an explicit preview entry instead of returning a root 404.
    # Do not pretend this fallback is a restored original homepage.
    if "/" not in written:
        fallback = "vps/" if "/vps" in written else (sorted(written)[0].lstrip("/") + "/" if written else "")
        if fallback:
            (OUT / "index.html").write_text(
                '<!doctype html><html lang="en"><head><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>NewVPS archived preview</title>'
                '<meta http-equiv="refresh" content="0;url=' + fallback + '">'
                '</head><body><main><h1>NewVPS archived preview</h1>'
                '<p>The original homepage has not yet been captured. '
                'Opening an available archived page.</p>'
                '<p><a href="' + fallback + '">Open archived VPS page</a></p>'
                '</main></body></html>', encoding="utf-8"
            )
            print(f"Root preview entry generated, pointing to archived {fallback}")
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
        html = html.replace("assets/", "/_captures/" + capture_id + "/assets/")
        destination.write_text(html, encoding="utf-8")
        asset_source = source.parent / "assets"
        if asset_source.is_dir():
            shutil.copytree(asset_source, OUT / "_captures" / capture_id / "assets", dirs_exist_ok=True)
        order_count += 1
    print(f"Preserved {order_count} original order snapshots under /archived-order/")
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
    # Make known missing navigation routes reachable without fabricating archive content.
    # These placeholders are visibly marked as incomplete, and are never counted as restored pages.
    from html import escape
    placeholder_count = 0
    for target, sources in sorted(missing_links.items()):
        parts = safe_route(target)
        if parts is None or target == "/":
            continue
        destination = OUT.joinpath(*parts, "index.html")
        if destination.exists():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        lang = "ru" if target.startswith("/ru/") or target == "/ru" else ("zh" if target.startswith("/zh/") or target == "/zh" else "en")
        message = {"en": ("Archived page not yet available", "This URL was found in the original site's navigation, but its original page was not included in the supplied captures."),
                   "zh": ("原始页面尚未收录", "原网站导航包含此链接，但提供的归档文件中尚无对应页面。"),
                   "ru": ("Архивная страница пока недоступна", "Эта ссылка есть в навигации исходного сайта, но соответствующая страница отсутствует в предоставленном архиве.")}[lang]
        fallback = "/vps/" if "/vps" in known else "/"
        destination.write_text(
            '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="robots" content="noindex,nofollow">'
            '<title>' + escape(message[0]) + ' — NewVPS</title>'
            '<style>body{margin:0;background:#0b1220;color:#e8edf6;font:16px system-ui,sans-serif}'
            'main{max-width:680px;margin:12vh auto;padding:32px}h1{font-size:30px}'
            'a{color:#75baff}code{overflow-wrap:anywhere}</style></head>'
            '<body><main><h1>' + escape(message[0]) + '</h1><p>' + escape(message[1]) + '</p>'
            '<p><code>' + escape(target) + '</code></p>'
            '<p><a href="' + fallback + '">View available VPS archive / 查看已收录 VPS 页面</a></p>'
            '</main></body></html>', encoding="utf-8")
        placeholder_count += 1
    print(f"Generated {placeholder_count} clearly labeled missing-archive navigation pages")
    # Publish the same audit beside the static preview for convenient review.
    shutil.copy2(report, OUT / "missing-routes.csv")
    print(f"Navigation audit: {len(missing_links)} unresolved internal routes -> {report}")
    print(f"Built {len(written)} static preview routes in {OUT}")
    print("This is a static archive preview. Login, registration, checkout and payments are NOT functional.")
    print("Do not deploy to production without validating interactive functionality.")

if __name__ == "__main__":
    main()
