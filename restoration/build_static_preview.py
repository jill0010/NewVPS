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
  function init() { bind('langBtn', 'langMenu'); bind('mobBtn', 'mobMenu'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
"""
            html = html.replace("</body>", menu_fix + "</body>")
        target = OUT / route.lstrip("/") / "index.html" if route != "/" else OUT / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")

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
