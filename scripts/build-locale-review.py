#!/usr/bin/env python3
"""Produce a quarantined partial locale review artifact; never deploy it as website.

Only an isolated ZIP preview is produced. No status is elevated to 'approved':
machine-drafted phrases may contain translation mistakes. Existing English HTML,
prices, links, server scripts and original archives are not modified.
"""
from collections import Counter
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist-captured'
OUT=ROOT/'translation-review'
CAT=ROOT/'translation-catalog'
SKIP={'script','style','svg','noscript','code','pre','textarea'}
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
ATTRS={'placeholder','title','aria-label','alt'}
WORDS=re.compile(r'[A-Za-z]{2,}')
PROTECTED=re.compile(
    r'\$\s*[\d,.]+|'
    r'\b\d+(?:[.,]\d+)?\s*(?:GB|TB|MB|GHz|USD|EUR|TON|Mbps|Gbps|NVMe|vCPU)\b|'
    r'https?://[^\s<>"\']+|'
    r'\b[a-z0-9-]+\.(?:com|net|org|io|co|dev|app|xyz|me)\b|'
    r'\{[A-Za-z_][\w.]*\}|\$\{[^{}]+\}|%[sd]',re.I)
MODEL=re.compile(r'^(?:(?:Intel|AMD|NVIDIA|Xeon|EPYC|Ryzen|GeForce|RTX|GTX|Ubuntu|Debian|AlmaLinux|Rocky Linux|Windows Server|CentOS|Fedora|FreeBSD)[\s\S]*|\d+\s*[×x]\s*(?:Intel|AMD|NVIDIA)[\s\S]*)$',re.I)
PREFERRED=['/','/domains/','/domain-order/','/domain-pay/','/account/','/register/','/order/','/vps/','/dedicated/','/gpu/']
CORE=set(PREFERRED)

def key(text):return hashlib.sha256(' '.join(text.split()).encode()).hexdigest()[:20]
def protected(s):return Counter(m.group(0) for m in PROTECTED.finditer(s))

def valid(source,value):
    return isinstance(value,str) and bool(value.strip()) and value.strip()!=source.strip() and protected(source)==protected(value) and '<script' not in value.lower() and '</' not in value and '\x00' not in value

def risky(s,locale):
    # A deliberately narrow set of known examples from real faulty NMT output.
    if locale=='zh-CN' and re.search(r'(VPS舰|搭载\s*面值符|内核-泛体|英特尔·薛恩)',s,re.I):return True
    if locale=='ru' and 'объятий Токен лица' in s:return True
    return False

class Preview(HTMLParser):
    def __init__(self,lookup,locale):
        super().__init__(convert_charrefs=False)
        self.lookup=lookup
        self.locale=locale
        self.stack=[]
        self.parts=[]
        self.total=set()
        self.translated=set()
        self.untranslated=set()
        self.rejected=[]
    def resolve(self,raw,attribute=False):
        source=' '.join(raw.split())
        if not WORDS.search(source) or source.startswith(('http://','https://')) or MODEL.match(source):
            return raw
        identifier=key(source)
        self.total.add(identifier)
        value=self.lookup.get(identifier)
        if not valid(source,value) or risky(value,self.locale):
            self.untranslated.add(identifier)
            if value and risky(value,self.locale):self.rejected.append(identifier)
            return raw
        self.translated.add(identifier)
        prefix=raw[:len(raw)-len(raw.lstrip())]
        suffix=raw[len(raw.rstrip()):]
        return prefix+(escape(value,quote=True) if attribute else escape(value,quote=False))+suffix
    def handle_starttag(self,tag,attrs):
        if tag not in VOID:self.stack.append(tag)
        raw=self.get_starttag_text()
        if tag=='html':
            raw=re.sub(r'\blang=(["\']).*?\1',f'lang="{self.locale}"',raw,count=1,flags=re.I)
            if not re.search(r'\blang=',raw,re.I):raw=raw[:-1]+f' lang="{self.locale}">'
        if not any(t in SKIP for t in self.stack):
            for name,value in attrs:
                if name not in ATTRS or not value:continue
                translated=self.resolve(value,True)
                if translated==value:continue
                for q in ('"',"'"):
                    literal=name+'='+q+value+q
                    if literal in raw:
                        raw=raw.replace(literal,name+'='+q+translated+q,1)
                        break
        self.parts.append(raw)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID and self.stack:self.stack.pop()
    def handle_endtag(self,tag):
        if tag in self.stack:
            idx=len(self.stack)-1-self.stack[::-1].index(tag)
            self.stack=self.stack[:idx]
        self.parts.append(f'</{tag}>')
    def handle_data(self,raw):
        self.parts.append(raw if any(t in SKIP for t in self.stack) else self.resolve(raw))
    def handle_entityref(self,name):self.parts.append('&'+name+';')
    def handle_charref(self,name):self.parts.append('&#'+name+';')
    def handle_comment(self,data):self.parts.append('<!--'+data+'-->')
    def handle_decl(self,decl):self.parts.append('<!'+decl+'>')
    def handle_pi(self,data):self.parts.append('<?'+data+'>')

def main():
    if not DIST.is_dir() or not (CAT/'strings.json').is_file():
        raise SystemExit('First build dist-captured and translation-catalog/strings.json')
    catalog=json.loads((CAT/'strings.json').read_text(encoding='utf-8'))
    translations={}
    batch_counts={}
    for path in sorted((ROOT/'translations/drafts').glob('core-batch-*.json')):
        if path.name.endswith('-report.json'):continue
        data=json.loads(path.read_text(encoding='utf-8'))
        batch_counts[path.name]=len(data)
        for identifier,values in data.items():
            entry=translations.setdefault(identifier,{})
            for locale in ('ru','zh-CN'):
                if isinstance(values.get(locale),str) and values[locale].strip():
                    entry.setdefault(locale,values[locale])
    # Export missing source strings for translation review, grouped by actual route.
    # Machine drafts are never silently approved just because they passed token checks.
    missing_manifest=[]
    translated_count={'ru':0,'zh-CN':0}
    items=[]
    summary=[]
    for route in PREFERRED:
        relative=Path(*route.strip('/').split('/')) if route!='/' else Path()
        path=DIST/relative/'index.html'
        if not path.is_file():continue
        html=path.read_text(encoding='utf-8',errors='replace')
        for locale in ('ru','zh-CN'):
            lookup={}
            for identifier,entry in catalog.items():
                value=entry.get(locale) or translations.get(identifier,{}).get(locale)
                if value:lookup[identifier]=value
            p=Preview(lookup,locale)
            p.feed(html)
            translated_count[locale]+=len(p.translated)
            summary.append({'route':route,'locale':locale,'total_unique_nodes':len(p.total),
                            'translated_unique_nodes':len(p.translated),
                            'missing_unique_nodes':len(p.untranslated),
                            'known_bad_drafts_rejected':len(set(p.rejected))})
            for identifier in sorted(p.untranslated):
                source_entry=catalog.get(identifier,{})
                missing_manifest.append({
                    'route':route,'locale':locale,'key':identifier,
                    'source':source_entry.get('source',''),
                    'draft':lookup.get(identifier),
                    'requires_review':True
                })
            # HTML output is an offline review file, never an automatically deployed route.
            output_path=OUT/('ru' if locale=='ru' else 'zh-CN')/relative/'index.html'
            items.append((output_path,''.join(p.parts)))
    for path,html in items:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(html,encoding='utf-8')
    report={'status':'DRAFT_FOR_REVIEW_NOT_PUBLISHABLE',
            'source_unique_strings':len(catalog),
            'draft_batch_entries':batch_counts,
            'language_route_details':summary,
            'never_automatically_deploy':True,
            'important':'Draft previews contain untranslated English and machine translation errors; no locale switching enabled'}
    (OUT/'missing-translations.json').write_text(json.dumps(missing_manifest,ensure_ascii=False,indent=2)+'\\n',encoding='utf-8')
    (OUT/'review-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    zip_path=ROOT/'translation-review.zip'
    with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for path in sorted(OUT.rglob('*')):
            if path.is_file():archive.write(path,path.relative_to(ROOT))
    print('DRAFT REVIEW ONLY: created',len(items),'localized HTML preview files, report:',OUT/'review-report.json')
    print('This is NOT a deployable site and has not altered production paths or the original archives.')

if __name__=='__main__':main()
