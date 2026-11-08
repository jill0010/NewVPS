#!/usr/bin/env python3
"""Inventory interactive controls in captured pages without altering originals.

This is an evidence inventory, not a claim that dynamic backend flows work.
"""
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INDEX=ROOT/'restoration/page-index.json'
OUT=ROOT/'restoration/interaction-inventory.json'

class Controls(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.counts=Counter()
        self.examples={}
        self.scripts=[]
        self.inline_handlers=Counter()
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='script':
            self.scripts.append({'src':a.get('src'), 'type':a.get('type')})
        for name in a:
            if name.startswith('on') and len(name)>2:
                self.inline_handlers[name]+=1
        kind=None
        if tag=='button': kind='button'
        elif tag=='form': kind='form'
        elif tag=='select': kind='select'
        elif tag=='textarea': kind='textarea'
        elif tag=='input': kind='input:'+a.get('type','text').lower()
        elif tag=='a' and a.get('href'): kind='anchor'
        elif a.get('role') in ('button','tab','menuitem','switch','checkbox','combobox'): kind='role:'+a['role']
        if kind:
            self.counts[kind]+=1
            if len(self.examples.get(kind,[]))<5:
                self.examples.setdefault(kind,[]).append({
                    k:a[k][:180] for k in ('id','class','type','href','action','onclick','aria-label')
                    if k in a and a[k] is not None
                })

def main():
    index=json.loads(INDEX.read_text(encoding='utf-8'))
    results=[]
    total=Counter()
    for p in index['pages']:
        parser=Controls()
        parser.feed((ROOT/p['source']).read_text(encoding='utf-8',errors='replace'))
        total.update(parser.counts)
        results.append({'route':p['route'],'capture':p['capture'],'source':p['source'],
                        'controls':dict(sorted(parser.counts.items())),
                        'examples':parser.examples,
                        'scripts':parser.scripts,
                        'inline_handlers':dict(parser.inline_handlers)})
    report={'schema_version':1,'captures':len(results),
            'unique_routes':len({r['route'] for r in results}),
            'total_control_occurrences':dict(sorted(total.items())),
            'captures_with_script_tags':sum(bool(r['scripts']) for r in results),
            'total_script_tags':sum(len(r['scripts']) for r in results),
            'captures_with_inline_handlers':sum(bool(r['inline_handlers']) for r in results),
            'pages':results,
            'warning':'Inventory only. No interactions executed, no backend functionality asserted.'}
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:report[k] for k in ('captures','unique_routes','total_control_occurrences','captures_with_script_tags','total_script_tags','captures_with_inline_handlers')},ensure_ascii=False))
if __name__=='__main__': main()
