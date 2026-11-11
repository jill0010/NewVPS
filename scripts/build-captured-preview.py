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
import base64
import re
import shutil
import zipfile

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
        # Share immutable hashed assets across captured pages.
        prefix = "/_captures/shared/assets/"
        asset_source = source.parent / "assets"
        # All captured assets share immutable hashed filenames. Deploy each
        # unique filename once; original captures in extracted/ remain intact.
        shared_dest = OUT / "_captures" / "shared" / "assets"
        if asset_source.is_dir():
            for asset in asset_source.rglob("*"):
                if not asset.is_file():
                    continue
                rel = asset.relative_to(asset_source)
                dest = shared_dest / rel
                if not dest.exists():
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(asset, dest)
                elif asset.stat().st_size != dest.stat().st_size or asset.read_bytes() != dest.read_bytes():
                    raise SystemExit(f"Conflicting captured asset name: {rel}")
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
    # All original captures and order snapshots remain untouched in extracted/.
    # Avoid copying their redundant duplicates into the live site bundle.
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
        html = re.sub(r'(?<![\w/])assets/', "/_captures/shared/assets/", html)
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
    # Bind the archived homepage login controls to the working local account page.
    # Do not edit the original captured HTML or its visual assets.
    homepage = OUT / "index.html"
    if homepage.is_file():
        html = homepage.read_text(encoding="utf-8")
        login_bridge = r'''<script id="newvps-account-bridge">
(function(){
  function openAccount(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(document.getElementById('newvps-account-overlay'))return;
    var overlay=document.createElement('div');overlay.id='newvps-account-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
    var frame=document.createElement('iframe');frame.src='/register/?embed=1&view=login';frame.title='NewVPS account login';
    frame.style.cssText='width:min(100%,520px);height:min(100%,740px);border:0;background:transparent';
    var close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close login');
    close.style.cssText='position:absolute;right:16px;top:12px;border:0;background:white;border-radius:6px;padding:6px 12px;font-size:22px;cursor:pointer';
    close.onclick=function(){overlay.remove()};overlay.onclick=function(e){if(e.target===overlay)overlay.remove()};
    overlay.appendChild(frame);overlay.appendChild(close);document.body.appendChild(overlay);
  }
  document.addEventListener('click',function(e){
    var el=e.target.closest('a,button');if(!el)return;
    var label=(el.textContent||'').trim().toLowerCase();
    if(label==='login'||label==='log in'||label==='sign in'||label==='登录')openAccount(e);
  },true);
})();
</script>'''
        html = html.replace("</body>", login_bridge + "\n</body>", 1)
        homepage.write_text(html, encoding="utf-8")
        print("Connected archived homepage login controls to local account dialog")
    # Restore interactions for the captured dashboard top-up form, without
    # inventing a payment processor or modifying the original archive.
    dashboard = OUT / "account" / "index.html"
    if dashboard.is_file():
        html = dashboard.read_text(encoding="utf-8")
        bridge = r'''<script id="newvps-topup-bridge">
(function(){
  function init(){
    var form=document.getElementById('topup-form');if(!form)return;
    var amount=document.getElementById('topup-amount');
    var custom=document.getElementById('topup-custom-input');
    var buttons=[...form.querySelectorAll('[data-amt]')];
    // Correct the preset's actual visible label and value without touching archives.
    buttons.forEach(function(b){
      if(Number(b.dataset.amt)!==30)return;
      b.dataset.amt='50';
      b.querySelectorAll('*').forEach(function(node){
        if(node.children.length)return;
        var old=(node.textContent||'').trim();
        if(old==='$30'||old==='$30.00'||old==='30'||old==='30.00'){
          node.textContent=old.replace('30','50');
        }
      });
      b.setAttribute('aria-label',(b.getAttribute('aria-label')||'').replace('30','50'));
    });
    if(custom){custom.min='50';custom.max='2000';custom.placeholder=(custom.placeholder||'').replace('30','50');}
    if(amount){amount.min='50';amount.max='2000';}
    var msg=document.getElementById('topup-msg');
    function money(n){return '$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:2})}
    function render(value){
      var n=Number(value);if(!Number.isFinite(n)||n<50||n>2000){if(msg)msg.textContent='Enter an amount between $50 and $2,000.';return}
      if(msg)msg.textContent='';if(amount)amount.value=n;
      var chosen=buttons.find(b=>Number(b.dataset.amt)===n);
      buttons.forEach(function(b){
        var selected=b===chosen;
        b.classList.toggle('on',selected);
        b.style.backgroundColor=selected?'#edf1fc':'#fff';
        b.style.borderColor=selected?'#1a56db':'#e0e0e0';
        b.style.boxShadow=selected?'inset 0 0 0 1px #1a56db':'none';
        b.querySelectorAll('.tu-amt-val,.tu-amt-total').forEach(function(el){el.style.color=selected?'#1a56db':'#111'});
        var check=b.querySelector('.tu-amt-check');if(check)check.style.opacity=selected?'1':'0';
      });
      var customCard=custom&&custom.closest('.tu-amt-custom');
      if(customCard){
        var isCustom=!chosen;
        customCard.classList.toggle('on',isCustom);
        customCard.style.backgroundColor=isCustom?'#edf1fc':'#fff';
        customCard.style.borderColor=isCustom?'#1a56db':'#e0e0e0';
        customCard.style.boxShadow=isCustom?'inset 0 0 0 1px #1a56db':'none';
        var customCheck=customCard.querySelector('.tu-amt-check');if(customCheck)customCheck.style.opacity=isCustom?'1':'0';
      }
      var bonus=chosen?Number(chosen.dataset.bonus||0):0;
      var values={'topup-submit-amt':money(n),'tu-prev-add':money(n),'tu-prev-bonus':money(bonus),'tu-prev-after':money(n+bonus)};
      Object.entries(values).forEach(([id,value])=>{var el=document.getElementById(id);if(el)el.textContent=value});
      var row=document.getElementById('tu-prev-bonus-row');if(row)row.style.display=bonus?'':'none';
    }
    buttons.forEach(b=>b.addEventListener('click',function(){if(custom)custom.value='';render(b.dataset.amt)}));
    if(custom)custom.addEventListener('input',function(){render(custom.value)});
    render(100);
    // Restore the original archived cryptocurrency picker, whose site script
    // was not included in the static capture.
    var picker=document.getElementById('cs-topup');
    if(picker){
      var trigger=picker.querySelector('.cs-trigger');
      var panel=picker.querySelector('.cs-panel');
      var search=picker.querySelector('.cs-search');
      var label=picker.querySelector('.cs-label');
      var icon=picker.querySelector('.cs-icon');
      var hiddenValue=document.getElementById('cs-topup-val');
      var options=Array.from(picker.querySelectorAll('.cs-option'));
      function closePicker(){
        panel.hidden=true;panel.style.display='none';
        picker.classList.remove('cs-open');
        trigger.setAttribute('aria-expanded','false');
      }
      function openPicker(){
        panel.hidden=false;panel.style.display='flex';
        picker.classList.add('cs-open');
        trigger.setAttribute('aria-expanded','true');
        if(search){search.value='';search.dispatchEvent(new Event('input'));search.focus()}
      }
      trigger.addEventListener('click',function(){if(panel.hidden)openPicker();else closePicker()});
      options.forEach(function(option){
        option.addEventListener('click',function(){
          if(hiddenValue)hiddenValue.value=option.dataset.value||'';
          label.textContent=option.dataset.name||option.textContent.trim();
          label.classList.remove('cs-placeholder');
          if(icon){
            var source=option.querySelector('.cs-option-icon');
            if(source&&source.getAttribute('src')){icon.src=source.src;icon.hidden=false}
          }
          options.forEach(function(o){o.classList.toggle('cs-selected',o===option)});
          closePicker();
        });
      });
      if(search)search.addEventListener('input',function(){
        var query=search.value.trim().toLowerCase();
        options.forEach(function(o){
          o.hidden=!(o.dataset.haystack||o.textContent).toLowerCase().includes(query);
          o.style.display=o.hidden?'none':'';
        });
      });
      document.addEventListener('click',function(e){if(!picker.contains(e.target))closePicker()});
      document.addEventListener('keydown',function(e){if(e.key==='Escape')closePicker()});
      closePicker();
    }
    form.addEventListener('submit',function(e){e.preventDefault();if(msg)msg.textContent='Payment processing is not connected yet. No charge has been made.'});
    function tab(){var key=new URLSearchParams(location.search).get('tab')||'overview';
      document.querySelectorAll('[data-pane]').forEach(el=>{var active=el.dataset.pane===key;el.style.display=active?'':'none';el.classList.toggle('on',active)});
      document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('on',el.dataset.tab===key));
    }
    document.querySelectorAll('[data-tab]').forEach(a=>a.addEventListener('click',function(e){var key=a.dataset.tab;if(!key)return;e.preventDefault();history.pushState({},'',location.pathname+'?tab='+encodeURIComponent(key));tab()}));
    addEventListener('popstate',tab);tab();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>'''
        html = html.replace("</body>", bridge + "\n</body>", 1)
        dashboard.write_text(html, encoding="utf-8")
        print("Enabled archived account top-up amount selection and preview; payment remains disabled")
    # Keep the original captured form; attach the isolated quote overlay after
    # the existing amount/currency interaction bridge.
    quote_source = ROOT / "scripts/newvps-payment-quote.js"
    if dashboard.is_file() and quote_source.is_file():
        quote_target = OUT / "newvps-payment-quote.js"
        shutil.copy2(quote_source, quote_target)
        html = dashboard.read_text(encoding="utf-8")
        html = html.replace("</body>", '<script defer src="/newvps-payment-quote.js"></script>\\n</body>', 1)
        dashboard.write_text(html, encoding="utf-8")
        print("Attached crypto quote overlay to archived account top-up form")
    # Attach account navigation to all archived HTML routes, including /vps/.
    # Login is not limited to the homepage. The script also revokes the
    # account session when the dashboard Log out button is clicked.
    account_navigation = ROOT / "scripts/newvps-account-navigation.js"
    if account_navigation.is_file():
        shutil.copy2(account_navigation, OUT / "newvps-account-navigation.js")
        for page in OUT.rglob("index.html"):
            if page.parent in (OUT / "topup", OUT / "register"):
                continue
            html = page.read_text(encoding="utf-8")
            if "</body>" in html and 'newvps-account-navigation.js' not in html:
                html = html.replace("</body>", '<script defer src="/newvps-account-navigation.js"></script>\\n</body>', 1)
                page.write_text(html, encoding="utf-8")
        print("Restored login links and dashboard logout on archived pages")
    # Apply the brand wordmark on every captured page without editing ZIP archives.
    brand_source = ROOT / "scripts/newvps-brand-wordmark.js"
    if brand_source.is_file():
        shutil.copy2(brand_source, OUT / "newvps-brand-wordmark.js")
        for page in OUT.rglob("index.html"):
            html = page.read_text(encoding="utf-8")
            if "</body>" in html and 'newvps-brand-wordmark.js' not in html:
                html = html.replace("</body>", '<script defer src="/newvps-brand-wordmark.js"></script>\\n</body>', 1)
                page.write_text(html, encoding="utf-8")
    # Restore the original language dropdown on all captured pages.
    # Existing archive provides English, Russian and Simplified Chinese links.
    language_source = ROOT / "scripts/newvps-language-selector.js"
    if language_source.is_file():
        shutil.copy2(language_source, OUT / "newvps-language-selector.js")
        for page in OUT.rglob("index.html"):
            html = page.read_text(encoding="utf-8")
            if "</body>" in html and 'newvps-language-selector.js' not in html:
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-language-selector.js"></script>\\n</body>', 1)
                page.write_text(html, encoding="utf-8")
        print("Restored English, Russian and Simplified Chinese language selector")
    # Restore captured server configuration controls on every matching page.
    config_source = ROOT / "scripts/newvps-server-config.js"
    if config_source.is_file():
        shutil.copy2(config_source, OUT / "newvps-server-config.js")
        for page in OUT.rglob("index.html"):
            html = page.read_text(encoding="utf-8")
            if 'class="os-tab' in html:
                # Embed the original OS SVG bytes directly in the image source.
                # This avoids GitHub Pages URL rewriting and route-prefix issues.
                embedded = [0]
                def embed_os_image(img_match):
                    tag = img_match.group(0)
                    src_match = re.search(r'src="[^"]*anonport_com/([^"/]+[.]svg)"', tag)
                    if not src_match:
                        return tag
                    filename = src_match.group(1)
                    original = OUT / "_captures" / "shared" / "assets" / "anonport_com" / filename
                    if not original.is_file():
                        # Some captures are not selected by route deduplication;
                        # use their original archived icon without altering the archive.
                        candidates = list((ROOT / "extracted" / "new-captures" / "order-pages").rglob("assets/anonport_com/" + filename))
                        if not candidates:
                            raise RuntimeError(f"Missing original OS icon in all archives: {filename}")
                        original = candidates[0]
                    data = base64.b64encode(original.read_bytes()).decode("ascii")
                    embedded[0] += 1
                    return tag[:src_match.start()] + 'src="data:image/svg+xml;base64,' + data + '"' + tag[src_match.end():]
                def embed_os_label(label_match):
                    return re.sub(r'<img[^>]*>', embed_os_image, label_match.group(0))
                html = re.sub(
                    r'<label[^>]*class="[^"]*cfg-os[^"]*"[^>]*>.*?</label>',
                    embed_os_label,
                    html,
                    flags=re.DOTALL,
                )
                if embedded[0] == 0:
                    raise RuntimeError(f"No OS icons embedded in captured configuration page: {page}")
                print(f"Embedded {embedded[0]} original OS icons in {page.relative_to(OUT)}")
                if 'newvps-server-config.js' not in html:
                    html = html.replace("</body>", '<script defer src="/NewVPS/newvps-server-config.js"></script>\\n</body>', 1)
                page.write_text(html, encoding="utf-8")
        print("Restored captured server configuration interactions")
    domain_script = ROOT / "scripts/newvps-domain-search.js"
    if domain_script.is_file():
        shutil.copy2(domain_script, OUT / "newvps-domain-search.js")
        for page in OUT.rglob("index.html"):
            html = page.read_text(encoding="utf-8")
            if 'id="domSearchForm"' in html and 'newvps-domain-search.js' not in html:
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-domain-search.js"></script>\\n</body>', 1)
                page.write_text(html, encoding="utf-8")
        print("Restored captured domain search controls")
    # User-provided domain flow archives are authoritative for these three routes.
    # Upload the three original ZIPs to domain-captures/ without extracting or editing them.
    domain_captures = {
        "cloned-page-1794329970472.zip": "domains",
        "cloned-page-1794329995250.zip": "domain-order",
        "cloned-page-1794330020014.zip": "domain-pay",
    }
    whois_style_js = ROOT / "scripts/newvps-domain-whois-style.js"
    if whois_style_js.is_file():
        shutil.copy2(whois_style_js, OUT / "newvps-domain-whois-style.js")
    domain_pricing_js = ROOT / "scripts/newvps-domain-pricing.js"
    if domain_pricing_js.is_file():
        shutil.copy2(domain_pricing_js, OUT / "newvps-domain-pricing.js")
    domain_checkout_js = ROOT / "scripts/newvps-domain-checkout.js"
    if domain_checkout_js.is_file():
        shutil.copy2(domain_checkout_js, OUT / "newvps-domain-checkout.js")
    domain_flow_js = ROOT / "scripts/newvps-domain-capture-flow.js"
    if domain_flow_js.is_file():
        shutil.copy2(domain_flow_js, OUT / "newvps-domain-capture-flow.js")
    for filename, route in domain_captures.items():
        archive = ROOT / filename
        if not archive.is_file():
            print(f"Domain archive pending: {archive.relative_to(ROOT)}")
            continue
        with zipfile.ZipFile(archive) as z:
            if "index.html" not in z.namelist():
                raise RuntimeError(f"Missing index.html in {filename}")
            html = z.read("index.html").decode("utf-8", errors="replace")
            for member in z.infolist():
                if member.is_dir() or not member.filename.startswith("assets/"):
                    continue
                rel = Path(member.filename)
                if ".." in rel.parts or rel.is_absolute():
                    raise RuntimeError(f"Unsafe ZIP entry: {member.filename}")
                dest = OUT / "_captures" / "domain-flow" / filename.removesuffix(".zip") / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(z.read(member))
            asset_prefix = "/NewVPS/_captures/domain-flow/" + filename.removesuffix(".zip") + "/assets/"
            html = re.sub(r'(?<![\\w/])assets/', asset_prefix, html)
            dest = OUT / route / "index.html"
            dest.parent.mkdir(parents=True, exist_ok=True)
            # Keep the captured DOM and cards; repair only internal navigation
            # to the GitHub Pages project prefix.
            html = re.sub(
                r'(\\b(?:href|action)="/)(?!NewVPS/|_captures/|/)([^"]*)"',
                lambda m: m.group(1) + 'NewVPS/' + m.group(2),
                html,
            )
            # Domain captures are restored after the global language injection pass.
            # Explicitly include the same selector on these late-restored pages.
            if language_source.is_file() and 'newvps-language-selector.js' not in html:
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-language-selector.js"></script>\\n</body>', 1)
            if domain_flow_js.is_file():
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-domain-capture-flow.js"></script>\\n</body>', 1)
            if route == "domain-order" and whois_style_js.is_file():
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-domain-whois-style.js"></script>\\n</body>', 1)
            if route == "domain-order" and domain_pricing_js.is_file():
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-domain-pricing.js"></script>\\n</body>', 1)
            if brand_source.is_file():
                html = html.replace("</body>", '<script defer src="/newvps-brand-wordmark.js"></script>\\n</body>', 1)
            if route == "domain-pay" and domain_checkout_js.is_file():
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-domain-checkout.js"></script>\\n</body>', 1)
            dest.write_text(html, encoding="utf-8")
            written["/" + route] = filename
            print(f"Restored original domain flow: /{route}/ from {filename}")
    # English domain search capture supersedes the earlier localized capture.
    english_archive = ROOT / "新域名英文界面.zip"
    if english_archive.is_file():
        with zipfile.ZipFile(english_archive) as z:
            html_candidates = [n for n in z.namelist() if n.endswith("index.html") and not n.startswith("__MACOSX/")]
            if len(html_candidates) != 1:
                raise RuntimeError(f"Expected one English domain page in {english_archive.name}, got {html_candidates}")
            html_name = html_candidates[0]
            html = z.read(html_name).decode("utf-8", errors="replace")
            if 'domSearchForm' not in html:
                raise RuntimeError("English archive does not contain the original domain search form")
            base = Path(html_name).parent
            asset_root = "/NewVPS/_captures/domain-english/"
            for member in z.infolist():
                if member.is_dir():
                    continue
                rel = Path(member.filename)
                if ".." in rel.parts or rel.is_absolute():
                    raise RuntimeError(f"Unsafe English archive entry: {member.filename}")
                try:
                    asset_rel = rel.relative_to(base)
                except ValueError:
                    continue
                if not asset_rel.parts or asset_rel.parts[0] != "assets":
                    continue
                target = OUT / "_captures" / "domain-english" / asset_rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(member))
            html = re.sub(r'(?<![\\w/])assets/', asset_root + "assets/", html)
            html = re.sub(
                r'(\\b(?:href|action)="/)(?!NewVPS/|_captures/|/)([^"]*)"',
                lambda m: m.group(1) + 'NewVPS/' + m.group(2),
                html,
            )
            if domain_flow_js.is_file():
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-domain-capture-flow.js"></script>\\n</body>', 1)
            # This archive overwrites the earlier domain page, so re-inject
            # the global language selector after restoring its original HTML.
            if 'newvps-language-selector.js' not in html:
                html = html.replace("</body>", '<script defer src="/NewVPS/newvps-language-selector.js"></script>\\n</body>', 1)
            page = OUT / "domains" / "index.html"
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(html, encoding="utf-8")
            written["/domains"] = english_archive.name
            print("Restored English domain search from user-provided archive")
    # Provide the archived /topup URL as an alias of the original account top-up pane.
    # The actual form and styling remain those captured in the original account page.
    if dashboard.is_file():
        alias = OUT / "topup" / "index.html"
        alias.parent.mkdir(parents=True, exist_ok=True)
        alias.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/NewVPS/account/?tab=topup"><script>location.replace("/NewVPS/account/?tab=topup"+location.hash)</script><title>Top up</title><a href="/NewVPS/account/?tab=topup">Continue to Add credit</a></html>', encoding="utf-8")
        written["/topup"] = "alias of archived /account?tab=topup"
    # Restore the captured mobile hamburger interaction without altering archive HTML.
    # The original capture contains #mobBtn and #mobMenu but its source-site
    # event handlers are not guaranteed to survive static archiving.
    mobile_menu_js = r"""(function () {
  'use strict';
  function init() {
    var btn = document.getElementById('mobBtn');
    var menu = document.getElementById('mobMenu');
    if (!btn || !menu || btn.dataset.anonyMobileFixed) return;
    btn.dataset.anonyMobileFixed = '1';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-controls', 'mobMenu');
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    function setOpen(open) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.classList.toggle('on', open);
      menu.classList.toggle('on', open);
      menu.classList.toggle('open', open);
      if (open) {
        menu.style.setProperty('display', 'block', 'important');
        menu.style.setProperty('visibility', 'visible', 'important');
        menu.style.setProperty('opacity', '1', 'important');
        menu.style.setProperty('transform', 'none', 'important');
        menu.style.setProperty('pointer-events', 'auto', 'important');
        menu.style.setProperty('max-height', 'calc(100dvh - 70px)', 'important');
        menu.style.setProperty('overflow-y', 'auto', 'important');
        menu.style.setProperty('position', 'fixed', 'important');
        menu.style.setProperty('top', Math.round(btn.getBoundingClientRect().bottom + 8) + 'px', 'important');
        menu.style.setProperty('left', '0', 'important');
        menu.style.setProperty('right', '0', 'important');
        menu.style.setProperty('z-index', '9999', 'important');
      } else {
        ['display','visibility','opacity','transform','pointer-events','max-height','overflow-y','position','top','left','right','z-index'].forEach(function (name) {
          menu.style.removeProperty(name);
        });
      }
    }
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    }, true);
    document.addEventListener('click', function (event) {
      if (btn.getAttribute('aria-expanded') === 'true' && !menu.contains(event.target) && !btn.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a[href]')) setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (btn.getAttribute('aria-expanded') === 'true') {
        if (window.innerWidth > 900) setOpen(false);
        else menu.style.setProperty('top', Math.round(btn.getBoundingClientRect().bottom + 8) + 'px', 'important');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();"""
    (OUT / "newvps-mobile-menu.js").write_text(mobile_menu_js, encoding="utf-8")
    for page in OUT.rglob("index.html"):
        html = page.read_text(encoding="utf-8")
        if 'id="mobBtn"' in html and 'id="mobMenu"' in html and 'newvps-mobile-menu.js' not in html:
            html = html.replace("</body>", '<script defer src="/newvps-mobile-menu.js"></script>\\n</body>', 1)
            page.write_text(html, encoding="utf-8")
    print("Restored mobile hamburger menu toggle on captured pages")
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
