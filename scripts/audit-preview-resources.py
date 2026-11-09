#!/usr/bin/env python3
"""Audit all deployed HTML/CSS for unresolved local assets."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import csv, re, sys
root=Path("dist-captured")
issues=[]
class Reader(HTMLParser):
    def __init__(self): super().__init__(); self.refs=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        for key in ("src","href","poster","data-src","data-poster"):
            if d.get(key) and not (tag=="a" and key=="href"): self.refs.append((key,d[key]))
        for key in ("srcset","imagesrcset","data-srcset"):
            for part in d.get(key,"").split(","):
                if part.strip(): self.refs.append((key,part.strip().split()[0]))
def check(source, kind, url):
    url=url.strip().strip("\\\"'")
    parsed=urlsplit(url)
    if parsed.scheme or parsed.netloc or url.startswith(("#","//")):return
    path=unquote(parsed.path)
    if not path:return
    if path.startswith("/NewVPS/"): dest=root/path[len("/NewVPS/"):]
    elif path.startswith("/"): dest=root/path.lstrip("/")
    else:dest=source.parent/path
    if not dest.exists():issues.append((str(source.relative_to(root)),kind,url))
pages=list(root.rglob("index.html"))
styles=list(root.rglob("*.css"))
for page in pages:
    content=page.read_text(encoding="utf-8",errors="replace")
    parser=Reader();parser.feed(content)
    for kind,url in parser.refs:
        if kind=="href" and not re.search(r"\\.(?:css|js|png|svg|ico|woff2?|webp|jpg|jpeg)(?:[?#]|$)",url,re.I):continue
        check(page,kind,url)
    for url in re.findall(r"url\\(([^)]+)\\)",content):check(page,"inline-css",url)
for css in styles:
    content=css.read_text(encoding="utf-8",errors="replace")
    for url in re.findall(r"url\\(([^)]+)\\)",content):check(css,"css",url)
report=Path("reports/newvps-resource-audit.csv")
with report.open("w",encoding="utf-8",newline="") as f:
    w=csv.writer(f);w.writerow(("source","kind","missing_url"));w.writerows(issues)
print(f"Audited {len(pages)} pages, {len(styles)} stylesheets; {len(issues)} missing local references")
for item in issues[:30]:print("MISSING",*item)
if issues:sys.exit(1)
