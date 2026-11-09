#!/usr/bin/env python3
"""Build an original-content preview. Captured source files are read-only."""
from pathlib import Path
import json
import os
import re
import shutil
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "restoration/page-index.json"
OUT = ROOT / "site-preview"
ROOT_ASSETS = ("favicon.ico", "favicon-32-v2.png", "apple-touch-icon-v2.png", "manifest.json")

def main():
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    seen, conflicts, root_asset_gaps = {}, [], set()
    base = os.environ.get('PREVIEW_BASE_PATH', '').rstrip('/')
    if base and (not base.startswith('/') or '..' in base):
        raise SystemExit('Invalid PREVIEW_BASE_PATH')
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
        # Rewrite captured relative asset URLs only; do not modify copy or wording.
        html = re.sub(r'(?<=["\x27])assets/', f'/_captures/{capture}/assets/', html)
        # CSS url(assets/...) in captured inline styles is relative to each route.
        # Resolve it to the same immutable capture asset directory as HTML attributes.
        html = re.sub(
            r'url\(\s*(["\x27]?)assets/',
            lambda m: 'url(' + m.group(1) + f'/_captures/{capture}/assets/',
            html, flags=re.IGNORECASE
        )
        # Captured style attributes HTML-escape quotes inside CSS url(&quot;assets/...&quot;).
        # Keep original files immutable; only rewrite preview copies.
        html = re.sub(
            r'url\(\s*&quot;assets/',
            lambda m: f'url(&quot;/_captures/{capture}/assets/',
            html, flags=re.IGNORECASE
        )
        if base:
            # HTML entity quotes in style attributes prevent the generic url(/...) rule
            # from seeing the slash. Prefix these URLs for GitHub project Pages.
            html = html.replace('url(&quot;/_captures/', 'url(&quot;' + base + '/_captures/')
        if base:
            # GitHub project Pages are served below /NewVPS, not at domain root.
            # Rewrite local navigation and asset URL attributes only.
            html = re.sub(
                r'(?P<before>\b(?:href|src|action|poster)\s*=\s*["\x27])/(?P<path>[^"\x27]*)',
                lambda m: m.group('before') + base + '/' + m.group('path'),
                html, flags=re.IGNORECASE
            )
            html = re.sub(r'url\(\s*(["\x27]?)/(?!(?:/))',
                          lambda m: 'url(' + m.group(1) + base + '/', html)
        if base:
            # Captured inline scripts may set href="/" after the static HTML rewrite.
            # Scope this runtime navigation correction to the GitHub Pages preview.
            # Do not touch source archives or change any visible page content.
            nav_fix = """
<script data-restoration-preview-navigation>
(function () {
  const base = __BASE__;
  function fix() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      const raw = a.getAttribute('href');
      if (raw && raw[0] === '/' && raw[1] !== '/' &&
          !raw.startsWith(base + '/') && raw !== base) {
        a.setAttribute('href', base + raw);
      }
    });
  }
  fix();
  document.addEventListener('DOMContentLoaded', fix);
  new MutationObserver(fix).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['href']
  });
})();
</script>
""".replace("__BASE__", json.dumps(base))
            html = html.replace("</body>", nav_fix + "</body>")
        if base:
            # Correct captured same-site absolute URLs to the deployed preview.
            # Keep external destinations, mailto links and source snapshots intact.
            html = re.sub(
                r'(?P<attr>\\b(?:href|action)\\s*=\\s*["\\x27])https?://(?:www\\.)?anonport\\.com(?P<path>/[^"\\x27]*)',
                lambda m: m.group('attr') + base + m.group('path'),
                html, flags=re.IGNORECASE
            )
        if base:
            # The supplied DOM snapshots contain no executable menu handlers.
            # Restore only the existing captured controls in the preview.
            menu_fix = """
<script data-restoration-preview-menus>
(function () {
  function bind(buttonId, panelId) {
    const button = document.getElementById(buttonId);
    const panel = document.getElementById(panelId);
    if (!button || !panel) return;
    function setOpen(open) {
      button.setAttribute('aria-expanded', String(open));
      panel.style.setProperty('display', open ? 'block' : 'none', 'important');
      panel.style.setProperty('visibility', open ? 'visible' : 'hidden', 'important');
      panel.style.setProperty('opacity', open ? '1' : '0', 'important');
      panel.style.setProperty('pointer-events', open ? 'auto' : 'none', 'important');
      if (open) panel.style.setProperty('transform', 'none', 'important');
    }
    setOpen(false);
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      setOpen(button.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', function (event) {
      if (!button.contains(event.target) && !panel.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }
  function init() {
    bind('langBtn', 'langMenu');
    bind('mobBtn', 'mobMenu');
    const pairs = [['langBtn', 'langMenu'], ['mobBtn', 'mobMenu']];
    pairs.forEach(function (pair) {
      const button = document.getElementById(pair[0]);
      const panel = document.getElementById(pair[1]);
      if (!button || !panel) return;
      button.setAttribute('aria-haspopup', 'true');
      if (!panel.id) panel.id = pair[1];
      button.setAttribute('aria-controls', panel.id);
      button.addEventListener('click', function () {
        if (button.getAttribute('aria-expanded') !== 'true') return;
        pairs.forEach(function (other) {
          if (other[0] === pair[0]) return;
          const otherButton = document.getElementById(other[0]);
          const otherPanel = document.getElementById(other[1]);
          if (otherButton && otherPanel) {
            otherButton.setAttribute('aria-expanded', 'false');
            otherPanel.style.setProperty('display', 'none', 'important');
            otherPanel.style.setProperty('pointer-events', 'none', 'important');
          }
        });
      });
      panel.addEventListener('click', function (event) {
        const link = event.target.closest('a[href]');
        if (link) button.setAttribute('aria-expanded', 'false');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
"""
            html = html.replace("</body>", menu_fix + "</body>")
        target = OUT / route.lstrip("/") / "index.html" if route != "/" else OUT / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")

    # Captured navigation advertises localized paths that are absent from the
    # supplied archives. Provide explicit redirects to existing captured pages,
    # never fabricated translations or copied content under a false language.
    missing_localized = []
    known_routes = set(seen)
    for language in ("zh", "ru"):
        for route in sorted(known_routes):
            if route == "/" or route.startswith(("/zh/", "/ru/")):
                continue
            localized = f"/{language}{route}"
            if localized in known_routes:
                continue
            fallback = route.rstrip("/") + "/"
            target = OUT / localized.lstrip("/") / "index.html"
            target.parent.mkdir(parents=True, exist_ok=True)
            target_url = (base + fallback) if base else fallback
            # Redirect immediately; do not present English content as translated.
            target.write_text(
                '<!doctype html><html><head><meta charset="utf-8">'
                '<meta name="robots" content="noindex">'
                '<meta http-equiv="refresh" content="0;url=' + target_url + '">'
                '<title>Redirect to available captured page</title>'
                '</head><body><a href="' + target_url + '">'
                'Open available captured page</a></body></html>',
                encoding="utf-8"
            )
            missing_localized.append({"requested": localized, "fallback": route})

    # Audit captured navigation targets against actual preview files, including
    # links generated for language menus. Record unresolved paths explicitly.
    from html.parser import HTMLParser
    class LinkCollector(HTMLParser):
        def __init__(self):
            super().__init__()
            self.links = []
        def handle_starttag(self, tag, attrs):
            if tag == "a":
                self.links.extend(value for key, value in attrs if key == "href" and value)

    unresolved_links = []
    for route in sorted(known_routes):
        page_file = OUT / route.lstrip("/") / "index.html" if route != "/" else OUT / "index.html"
        parser = LinkCollector()
        parser.feed(page_file.read_text(encoding="utf-8"))
        for href in parser.links:
            parsed = urlsplit(href)
            if parsed.scheme or parsed.netloc or not parsed.path.startswith("/"):
                continue
            path = unquote(parsed.path)
            if base and path.startswith(base + "/"):
                path = path[len(base):]
            elif base and path != base:
                continue
            if path in ("", "/"):
                continue
            expected = OUT / path.lstrip("/")
            if not expected.is_file() and not (expected / "index.html").is_file():
                unresolved_links.append({"source": route, "href": href})
    unresolved_links = sorted(unresolved_links, key=lambda x: (x["source"], x["href"]))

    # Keep links usable without inventing missing source pages. Missing captures
    # get an explicit unavailable-source notice, not a fake restored page.
    missing_capture_routes = sorted({
        urlsplit(item["href"]).path[len(base):] if base and
        urlsplit(item["href"]).path.startswith(base + "/")
        else urlsplit(item["href"]).path
        for item in unresolved_links
        if urlsplit(item["href"]).path.startswith("/")
    })
    for missing_route in missing_capture_routes:
        if not missing_route or missing_route == "/" or ".." in Path(missing_route).parts:
            continue
        # File URLs are resources, not missing HTML pages.
        if Path(missing_route).suffix.lower() in {".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".ico", ".pdf", ".xml", ".json", ".txt", ".md", ".css", ".js"}:
            continue
        dest = OUT / missing_route.lstrip("/") / "index.html"
        if dest.exists() or (OUT / missing_route.lstrip("/")).is_file():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        home = (base + "/") if base else "/"
        dest.write_text(
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="robots" content="noindex"><title>Source capture unavailable</title>'
            '</head><body><main><h1>Original page capture unavailable</h1>'
            '<p>This route was linked by the supplied archive, but its original '
            'HTML was not included. No replacement content has been invented.</p>'
            '<p><a href="' + home + '">Return to captured homepage</a></p>'
            '</main></body></html>', encoding="utf-8"
        )

    # Some snapshots retain original /assets/img/*.webp references while the
    # identical image was captured in another page under its hashed name.
    # Restore only these verified originals; never synthesize replacement art.
    archived_rdp_images = {
        "hero-rdp.webp": "hero-rdp-*.webp",
        "cta-rdp.webp": "cta-rdp-*.webp",
    }
    for original_name, pattern in archived_rdp_images.items():
        candidates = sorted((ROOT / "extracted").glob(
            f"newvps*/cloned-page-*/assets/anonport_com/{pattern}"
        ))
        if candidates:
            dst = OUT / "assets" / "img" / original_name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(candidates[0], dst)
        else:
            root_asset_gaps.add(f"assets/img/{original_name}")

    # Restore original icon bytes from captured, content-hashed asset files.
    # Never substitute invented images. Missing non-captured metadata is reported.
    icon_patterns = {
        "favicon.ico": "favicon-*.ico",
        "favicon-32-v2.png": "favicon-32-v2-*.png",
        "apple-touch-icon-v2.png": "apple-touch-icon-v2-*.png",
    }
    for name, pattern in icon_patterns.items():
        candidates = sorted((ROOT / "extracted").glob(
            f"newvps*/cloned-page-*/assets/anonport_com/{pattern}"
        ))
        if candidates:
            shutil.copy2(candidates[0], OUT / name)
        else:
            root_asset_gaps.add(name)
    # Preserve the report for files that are absent from the user-provided captures.
    if not (OUT / "manifest.json").exists():
        root_asset_gaps.add("manifest.json")

    (OUT / ".nojekyll").write_text("")
    report = {
        "captures": len(data["pages"]),
        "localized_fallback_redirects": missing_localized,
        "unresolved_navigation_links": unresolved_links,
        "missing_capture_notice_routes": [route for route in missing_capture_routes if not Path(route).suffix],
        "published_routes": len(seen),
        "conflicts": conflicts,
        "root_asset_gaps": sorted(root_asset_gaps),
        "note": "Captured content only. Dynamic backend behavior is not recreated."
    }
    (OUT / "restoration-build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if len(seen) != data["unique_route_count"]:
        raise SystemExit("Route count mismatch")

if __name__ == "__main__":
    main()
