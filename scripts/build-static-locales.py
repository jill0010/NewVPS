#!/usr/bin/env python3
"""Build static Russian/Chinese localized HTML only when reviewed translations are complete.

This tool does not translate. It uses only approved-translations.json entries and
refuses to overwrite the English original or produce misleading incomplete pages.
"""
from collections import Counter
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import hashlib
import json
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'dist-captured'
OUT=ROOT/'dist-localized'
CAT=ROOT/'translation-catalog'
SKIP={'script','style','svg','noscript','code','pre','textarea'}
ATTRS={'placeholder','title','aria-label','alt'}
WORDS=re.compile(r'[A-Za-z]{2,}')
PROTECTED=re.compile(r'\$\s*[\d,.]+|\b\d+(?:\.\d+)?\s*(?:GB|TB|MB|GHz|USD|EUR|TON|Mbps|Gbps)\b|\b[a-z0-9-]+\.(?:com|net|org|io|co|dev|app|xyz|me)\b',re.I)
PLACEHOLDERS=re.compile(r'\{[A-Za-z_][\w.]*\}|%[sd]|\$\{[^{}]+\}')

def normalize(s):return ' '.join(s.split())
def key(s):return hashlib.sha256(normalize(s).encode()).hexdigest()[:20]
def safe_translation(source,translated):
    if not isinstance(translated,str) or not translated.strip():return False
    if normalize(source)==normalize(translated):return False
    protected=lambda s:Counter(PROTECTED.findall(s)+PLACEHOLDERS.findall(s))
    return protected(source)==protected(translated) and '<script' not in translated.lower() and '</' not in translated

class Translator(HTMLParser):
    """Output original tags untouched; translate text and safe human-facing attributes only."""
    def __init__(self,lookup,locale):
        super().__init__(convert_charrefs=False)
        self.lookup=lookup
        self.locale=locale
        self.stack=[]
        self.parts=[]
        self.seen=set()
        self.missing=[]
    def translate(self,raw):
        source=normalize(raw)
        if not WORDS.search(source) or source.startswith(('http://','https://')):return raw
        identifier=key(source)
        self.seen.add(identifier)
        target=self.lookup.get(identifier)
        if not target or not safe_translation(source,target):
            self.missing.append(source)
            return raw
        prefix=raw[:len(raw)-len(raw.lstrip())]
        suffix=raw[len(raw.rstrip()):]
        return prefix+escape(target,quote=False)+suffix
    def handle_starttag(self,tag,attrs):
        self.stack.append(tag)
        raw=self.get_starttag_text()
        if tag=='html':
            raw=re.sub(r'(?i)\blang=(["\']).*?\1',f'lang="{self.locale}"',raw,count=1)
            if not re.search(r'(?i)\blang=',raw):raw=raw[:-1]+f' lang="{self.locale}">'
        # Attribute replacement is deliberately conservative: dynamic values,
        # JS handlers, URLs, data-* and pricing properties stay untouched.
        if not any(x in SKIP for x in self.stack):
            for name,value in attrs:
                if name not in ATTRS or not value:continue
                translated=self.translate(value)
                if translated==value:continue
                # Apply only when exact, quoted attribute source is found.
                for quote in ('"',"'"):
                    match=name+'='+quote+value+quote
                    if match in raw:
                        raw=raw.replace(match,name+'='+quote+escape(translated,quote=True)+quote,1)
                        break
        self.parts.append(raw)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if self.stack:self.stack.pop()
    def handle_endtag(self,tag):
        if tag in self.stack:
            i=len(self.stack)-1-self.stack[::-1].index(tag)
            self.stack=self.stack[:i]
        self.parts.append(f'</{tag}>')
    def handle_data(self,data):
        self.parts.append(data if any(t in SKIP for t in self.stack) else self.translate(data))
    def handle_entityref(self,name):self.parts.append('&'+name+';')
    def handle_charref(self,name):self.parts.append('&#'+name+';')
    def handle_comment(self,data):self.parts.append('<!--'+data+'-->')
    def handle_decl(self,decl):self.parts.append('<!'+decl+'>')
    def handle_pi(self,data):self.parts.append('<?'+data+'>')
    def unknown_decl(self,data):self.parts.append('<!['+data+']>')

def main():
    if not SRC.is_dir():raise SystemExit('Build original dist-captured first')
    translations_path=CAT/'approved-translations.json'
    if not translations_path.is_file():
        raise SystemExit('No approved offline translations; static locale generation blocked')
    catalog=json.loads((CAT/'strings.json').read_text(encoding='utf-8'))
    approved=json.loads(translations_path.read_text(encoding='utf-8'))
    # Check every extracted source before writing anything.
    errors=[]
    for identifier,entry in catalog.items():
        source=entry['source']
        if identifier!=key(source):
            errors.append(identifier+': source hash mismatch')
        for locale in ('ru','zh-CN'):
            target=approved.get(identifier,{}).get(locale)
            if not safe_translation(source,target):
                errors.append(identifier+'/'+locale+': missing or corrupt translation')
    if errors:
        print(f'Blocked: {len(errors)} missing/corrupt locale strings; first 15:',file=sys.stderr)
        for message in errors[:15]:print(message,file=sys.stderr)
        raise SystemExit(2)
    if OUT.exists() and any(OUT.iterdir()):
        raise SystemExit('Output folder exists; remove generated dist-localized before rebuilding')
    prepared=[]
    for page in sorted(SRC.rglob('index.html')):
        rel=page.relative_to(SRC)
        if rel.parts and rel.parts[0] in ('ru','zh','_captures'):continue
        raw=page.read_text(encoding='utf-8')
        for locale,prefix in (('ru','ru'),('zh-CN','zh')):
            lookup={k:v[locale] for k,v in approved.items()}
            parser=Translator(lookup,locale)
            parser.feed(raw)
            if parser.missing:
                errors.append(f'{prefix}/{rel}: {len(parser.missing)} missing text nodes')
                continue
            prepared.append((OUT/prefix/rel,''.join(parser.parts)))
    if errors:
        raise SystemExit('Aborted static generation: '+'; '.join(errors[:10]))
    for path,content in prepared:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(content,encoding='utf-8')
    print(f'Generated {len(prepared)} reviewed localized HTML files in {OUT}')
    print('English original and production language selector are unchanged.')

if __name__=='__main__':main()
