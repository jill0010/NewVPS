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
    var frame=document.createElement('iframe');frame.src='/NewVPS/register/?embed=1';frame.title='NewVPS account login';
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
    var msg=document.getElementById('topup-msg');
    function money(n){return '$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:2})}
    function render(value){
      var n=Number(value);if(!Number.isFinite(n)||n<30||n>2000){if(msg)msg.textContent='Enter an amount between $30 and $2,000.';return}
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
    # Attach a payment quotation preview to the original archived form. Quotes
    # require a fresh public market price; they do not constitute paid orders.
    if dashboard.is_file():
        html = dashboard.read_text(encoding="utf-8")
        payment_bridge = r'''<script id="newvps-payment-quote-bridge">
(function(){
  var coins={
    BTC:{id:'bitcoin',name:'Bitcoin',address:'bc1pulkdswkehc7ck9ajjynlxet0ptftlgcp58fyznvdp53da7ps5trsyf7ehu',digits:8},
    XMR:{id:'monero',name:'Monero',address:'874FwY5eyW4EDk7m23yUzwFUjdyU4Z9UNdhjPSreTmFmQezXWz9i5JMe5z5rADUveVTe6mTxab3Z5FiGGkX9me5qSjBRpVb',digits:8},
    ETH:{id:'ethereum',name:'Ethereum',address:'0xfc20a17b56cd97ffe2551fc8518257e4aacf36cf',digits:8},
    USDT:{id:'tether',name:'USDT (ERC-20)',address:'0xfc20a17b56cd97ffe2551fc8518257e4aacf36cf',digits:6},
    USDTTRC:{id:'tether',name:'USDT (TRC-20)',address:'TNjmN9KYUmEDCz5PoAttDcxeCuFvrxBBce',digits:6},
    LTC:{id:'litecoin',name:'Litecoin',address:'MQ3z4NC8YWA4i4d2QM1fLz8zRv8x2T3SKe',digits:8},
    TRX:{id:'tron',name:'TRON',address:'TNjmN9KYUmEDCz5PoAttDcxeCuFvrxBBce',digits:6},
    SOL:{id:'solana',name:'Solana',address:'5A1rpSKKZtCgZpVwS1PLqc5M77oVkAWD4NfKKMuzd5Jz',digits:8}
  };
  function node(tag,text){var el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el}
  function start(){
    var picker=document.getElementById('cs-topup'),amount=document.getElementById('topup-amount');
    if(!picker||!amount)return;
    var css=node('style');
    css.textContent='#nv-quote{position:fixed;inset:0;background:rgba(10,18,32,.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px}#nv-quote .nv-card{background:white;border-radius:9px;width:min(100%,850px);max-height:92vh;overflow:auto;box-shadow:0 20px 70px #0003;color:#172032;font:14px system-ui,sans-serif}#nv-quote .nv-head{padding:20px 24px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}#nv-quote .nv-cols{display:grid;grid-template-columns:1.5fr 1fr}#nv-quote .nv-side{padding:24px;border-left:1px solid #e5e7eb;text-align:center}#nv-quote .nv-main{padding:24px}#nv-quote .nv-row{display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #e5e7eb;padding:15px 0}#nv-quote .nv-address{overflow-wrap:anywhere;background:#f4f6f9;padding:12px;border-radius:5px;text-align:left;font-family:monospace}#nv-quote button{cursor:pointer;border:1px solid #dce0e5;border-radius:5px;padding:8px 13px;background:#fff}#nv-quote .nv-muted{color:#667085;font-size:12px}#nv-quote .nv-qr{width:180px;height:180px;max-width:100%;margin:14px auto}#nv-quote .nv-warning{color:#9a6700;background:#fff8e7;padding:12px;border-radius:5px;margin-top:16px}@media(max-width:650px){#nv-quote .nv-cols{grid-template-columns:1fr}#nv-quote .nv-side{border-left:0;border-top:1px solid #e5e7eb}}';
    document.head.appendChild(css);
    var current=0;
    async function show(code){
      var coin=coins[code];if(!coin)return;
      var usd=Number(amount.value);
      if(!Number.isFinite(usd)||usd<30||usd>2000)return;
      var seq=++current;
      var overlay=node('div');overlay.id='nv-quote';
      var card=node('div');card.className='nv-card';overlay.appendChild(card);
      var header=node('div');header.className='nv-head';header.appendChild(node('strong','Topup balance — '+coin.name));
      var close=node('button','×');close.setAttribute('aria-label','Close');close.onclick=function(){current++;overlay.remove()};header.appendChild(close);card.appendChild(header);
      var loading=node('div','Fetching live USD exchange rate…');loading.style.padding='30px';card.appendChild(loading);
      document.getElementById('nv-quote')?.remove();document.body.appendChild(overlay);
      overlay.addEventListener('click',function(e){if(e.target===overlay)close.click()});
      try{
        var response=await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+encodeURIComponent(coin.id)+'&vs_currencies=usd',{cache:'no-store'});
        if(!response.ok)throw Error('Rate provider unavailable');
        var json=await response.json(),price=Number(json[coin.id]&&json[coin.id].usd);
        if(!Number.isFinite(price)||price<=0)throw Error('Invalid market quote');
        if(seq!==current)return;
        var fraction=crypto.getRandomValues(new Uint32Array(1))[0]%900+100;
        var decimals=coin.digits;
        var base=Math.ceil((usd/price)*Math.pow(10,decimals));
        var units=base+fraction;
        var payable=(units/Math.pow(10,decimals)).toFixed(decimals);
        loading.remove();
        var cols=node('div');cols.className='nv-cols';card.appendChild(cols);
        var main=node('div');main.className='nv-main';cols.appendChild(main);
        main.appendChild(node('h3','Add 
    # The actual form and styling remain those captured in the original account page.
    if dashboard.is_file():
        alias = OUT / "topup" / "index.html"
        alias.parent.mkdir(parents=True, exist_ok=True)
        alias.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/NewVPS/account/?tab=topup"><script>location.replace("/NewVPS/account/?tab=topup"+location.hash)</script><title>Top up</title><a href="/NewVPS/account/?tab=topup">Continue to Add credit</a></html>', encoding="utf-8")
        written["/topup"] = "alias of archived /account?tab=topup"
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
+usd.toFixed(2)+' to your account'));
        var line=node('p','Reference: '+Date.now().toString(36).toUpperCase()+'-'+fraction);line.className='nv-muted';main.appendChild(line);
        function row(a,b){var el=node('div');el.className='nv-row';el.appendChild(node('span',a));el.appendChild(node('strong',b));main.appendChild(el)}
        row('What you are paying','
    # The actual form and styling remain those captured in the original account page.
    if dashboard.is_file():
        alias = OUT / "topup" / "index.html"
        alias.parent.mkdir(parents=True, exist_ok=True)
        alias.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/NewVPS/account/?tab=topup"><script>location.replace("/NewVPS/account/?tab=topup"+location.hash)</script><title>Top up</title><a href="/NewVPS/account/?tab=topup">Continue to Add credit</a></html>', encoding="utf-8")
        written["/topup"] = "alias of archived /account?tab=topup"
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
+usd.toFixed(2)+' USD');
        row('What you receive','
    # The actual form and styling remain those captured in the original account page.
    if dashboard.is_file():
        alias = OUT / "topup" / "index.html"
        alias.parent.mkdir(parents=True, exist_ok=True)
        alias.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/NewVPS/account/?tab=topup"><script>location.replace("/NewVPS/account/?tab=topup"+location.hash)</script><title>Top up</title><a href="/NewVPS/account/?tab=topup">Continue to Add credit</a></html>', encoding="utf-8")
        written["/topup"] = "alias of archived /account?tab=topup"
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
+usd.toFixed(2)+' in account credit (pending verification)');
        row('Live indicative rate','1 '+code+' ≈ 
    # The actual form and styling remain those captured in the original account page.
    if dashboard.is_file():
        alias = OUT / "topup" / "index.html"
        alias.parent.mkdir(parents=True, exist_ok=True)
        alias.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/NewVPS/account/?tab=topup"><script>location.replace("/NewVPS/account/?tab=topup"+location.hash)</script><title>Top up</title><a href="/NewVPS/account/?tab=topup">Continue to Add credit</a></html>', encoding="utf-8")
        written["/topup"] = "alias of archived /account?tab=topup"
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
+price.toLocaleString('en-US')+' USD');
        row('Total',payable+' '+code);
        var warn=node('div','Quote preview only — no server-side order has been created. Do not send funds until payment processing and transaction verification are enabled.');warn.className='nv-warning';main.appendChild(warn);
        var side=node('div');side.className='nv-side';cols.appendChild(side);
        side.appendChild(node('strong','Pay with '+coin.name));
        var qr=node('img');qr.className='nv-qr';qr.alt='QR for '+coin.name+' receiving address';
        qr.src='https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(coin.address);
        side.appendChild(qr);
        side.appendChild(node('p','Amount: '+payable+' '+code));
        side.appendChild(node('p','To address:'));
        var addr=node('div',coin.address);addr.className='nv-address';side.appendChild(addr);
        var copy=node('button','Copy address');copy.onclick=function(){navigator.clipboard.writeText(coin.address).then(function(){copy.textContent='Copied'})};side.appendChild(copy);
        var copyAmount=node('button','Copy amount');copyAmount.onclick=function(){navigator.clipboard.writeText(payable).then(function(){copyAmount.textContent='Copied'})};side.appendChild(copyAmount);
        var status=node('p','Waiting for payment verification (not connected)');status.className='nv-muted';side.appendChild(status);
      }catch(e){if(seq===current){loading.textContent='Live exchange rate unavailable. No payable amount can be generated. Please try again later.'}}
    }
    picker.querySelectorAll('.cs-option').forEach(function(option){
      option.addEventListener('click',function(){show(option.dataset.value)},false);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>'''
        html = html.replace("</body>", payment_bridge + "\n</body>", 1)
        dashboard.write_text(html, encoding="utf-8")
        print("Added archived-style live-rate quotation preview (no payment settlement)")
    # Provide the archived /topup URL as an alias of the original account top-up pane.
    # The actual form and styling remain those captured in the original account page.
    if dashboard.is_file():
        alias = OUT / "topup" / "index.html"
        alias.parent.mkdir(parents=True, exist_ok=True)
        alias.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/NewVPS/account/?tab=topup"><script>location.replace("/NewVPS/account/?tab=topup"+location.hash)</script><title>Top up</title><a href="/NewVPS/account/?tab=topup">Continue to Add credit</a></html>', encoding="utf-8")
        written["/topup"] = "alias of archived /account?tab=topup"
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
