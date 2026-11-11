#!/usr/bin/env python3
"""Validate approved Russian/Chinese text before any localized pages are published.

Use after extract-static-translations.py. Rejects data corruption and incomplete
locales; never translates or rewrites the original English HTML.
"""
from collections import Counter
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'translation-catalog'
PROTECTED=re.compile(
    r'\$\s*[\d,.]+|'
    r'\b(?:\d+(?:\.\d+)?\s*(?:GB|TB|MB|GHz|USD|EUR|TON|Mbps|Gbps|years?|months?))\b|'
    r'\b(?:https?://\S+|[a-z0-9-]+\.(?:com|net|org|io|co|dev|app|xyz|me))\b|'
    r'\b(?:/[a-z][\w/-]*(?:\?[\w=&%.-]+)?)\b',
    re.I
)
PLACEHOLDERS=re.compile(r'\{[A-Za-z_][\w.]*\}|%[sd]|\$\{[^{}]+\}')

def tokens(source):
    return Counter(PROTECTED.findall(source)+PLACEHOLDERS.findall(source))

def main():
    if not (CATALOG/'strings.json').is_file():
        raise SystemExit('No translation inventory: first run extract-static-translations.py')
    catalog=json.loads((CATALOG/'strings.json').read_text(encoding='utf-8'))
    errors=[]
    translated={'ru':0,'zh-CN':0}
    for key,entry in catalog.items():
        source=entry['source']
        expected=hashlib.sha256(source.encode()).hexdigest()[:20]
        if key!=expected:
            errors.append(f'{key}: source checksum mismatch')
        for lang in ('ru','zh-CN'):
            value=entry.get(lang)
            if value is None or value=='':
                continue
            if not isinstance(value,str) or not value.strip():
                errors.append(f'{key}/{lang}: translation must be nonempty text')
                continue
            if value.strip()==source.strip():
                errors.append(f'{key}/{lang}: untranslated English source')
            if tokens(source)!=tokens(value):
                errors.append(f'{key}/{lang}: protected price/domain/quantity/placeholder token changed: '+str(tokens(source)-tokens(value)))
            if '<script' in value.lower() or '</' in value:
                errors.append(f'{key}/{lang}: unexpected HTML markup')
            translated[lang]+=1
    coverage={'unique_strings':len(catalog),'ru_verified':translated['ru'],
              'zh_CN_verified':translated['zh-CN'],
              'ru_coverage':round(100*translated['ru']/max(len(catalog),1),2),
              'zh_CN_coverage':round(100*translated['zh-CN']/max(len(catalog),1),2),
              'errors':len(errors),'ready_to_publish':not errors and all(v==len(catalog) for v in translated.values())}
    CATALOG.mkdir(exist_ok=True)
    (CATALOG/'validation.json').write_text(json.dumps({'summary':coverage,'errors':errors[:1000]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(coverage,ensure_ascii=False))
    for e in errors[:20]: print('ERROR:',e,file=sys.stderr)
    if errors:
        raise SystemExit(f'{len(errors)} invalid translations; static locale publishing blocked')
    if not coverage['ready_to_publish']:
        print('NOTICE: Translation inventory passes integrity validation; full offline localization is NOT ready.')
    else:
        print('PASS: All strings have independently verified offline translations.')

if __name__=='__main__':main()
