#!/usr/bin/env python3
"""Inventory visible text for offline ru/zh-CN translation, without modifying archives.

Run after: python3 scripts/build-captured-preview.py
Produces translation-catalog/strings.json and translation-catalog/coverage.json.
No translated pages are published until translations are complete and verified.
"""
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist-captured'
OUT=ROOT/'translation-catalog'
SKIP={'script','style','svg','noscript','code','pre','textarea'}
ATTRS={'placeholder','title','aria-label','alt'}
WORDS=re.compile(r'[A-Za-z]{2,}')
VARIABLE=re.compile(r'(\$[\d,.]+|(?:\b\d+(?:\.\d+)?\s*(?:GB|TB|MB|GHz|USD|EUR|TON|months?|years?)\b)|\b[a-z0-9-]+\.[a-z]{2,}\b)',re.I)

class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack=[]
        self.items=set()
    def handle_starttag(self,tag,attrs):
        self.stack.append(tag)
        if tag in SKIP or any(t in SKIP for t in self.stack):return
        for k,v in attrs:
            if k in ATTRS and v:self.record(v)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs);self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if tag in self.stack:
            i=len(self.stack)-1-self.stack[::-1].index(tag)
            self.stack=self.stack[:i]
    def handle_data(self,data):
        if not any(t in SKIP for t in self.stack):self.record(data)
    def record(self,data):
        value=' '.join(data.split())
        if value and WORDS.search(value) and not value.startswith(('http://','https://')):
            self.items.add(value)

def main():
    if not DIST.is_dir():raise SystemExit('Run scripts/build-captured-preview.py first')
    references=defaultdict(set)
    routes=[]
    for path in sorted(DIST.rglob('index.html')):
        route='/'+'/'.join(path.parent.relative_to(DIST).parts)
        if route!='/':route+='/'
        if route.startswith(('/_captures/','/ru/','/zh/')):continue
        parser=Extractor()
        parser.feed(path.read_text(encoding='utf-8',errors='replace'))
        routes.append(route)
        for value in parser.items:references[value].add(route)
    catalog={}
    for value,locations in sorted(references.items()):
        key=hashlib.sha256(value.encode()).hexdigest()[:20]
        catalog[key]={'source':value,'protected_tokens':VARIABLE.findall(value),'routes':sorted(locations),'ru':None,'zh-CN':None}
    OUT.mkdir(exist_ok=True)
    (OUT/'strings.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    coverage={'routes':len(routes),'unique_strings':len(catalog),'ru_translated':0,'zh_CN_translated':0,'published_static_locales':False,'reason':'Full human-reviewed translations required; never publish English as translated content.'}
    (OUT/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(coverage,ensure_ascii=False))

if __name__=='__main__':main()
