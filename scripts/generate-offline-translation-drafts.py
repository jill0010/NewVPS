#!/usr/bin/env python3
"""Generate RU / zh-CN offline translation *drafts* using local Argos NMT.

Only GitHub Actions build-time is allowed to download language models.
Never calls a translation service from the website. Never edits source ZIP,
current English pages, production language selector, or approved dictionary.
"""
import argparse
from collections import Counter
from pathlib import Path
import json
import re
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
CAT=ROOT/'translation-catalog'
CORE_ROUTES={'/','/domains/','/domain-order/','/domain-pay/','/account/',
             '/register/','/vps/','/dedicated/','/gpu/','/order/'}
# Extract units, website addresses and interpolation variables intact.
PROTECTED=re.compile(
    r'\$\s*[\d,.]+|'
    r'\b\d+(?:[.,]\d+)?\s*(?:GB|TB|MB|GHz|Mbps|Gbps|USD|EUR|TON|NVMe|vCPU)\b|'
    r'https?://[^\s<>"]+|'
    r'\b[a-z0-9-]+\.(?:com|net|org|io|co|dev|app|xyz|me)\b|'
    r'\{[A-Za-z_][\w.]*\}|\$\{[^{}]+\}|%[sd]',
    re.I
)
INVARIANT=re.compile(r'^(?:[\d\s.,%$€£+\-/()×]+|[A-Z0-9+\-/]{2,}|[.@+][\w.-]+)
LATIN=re.compile(r'[A-Za-z]{2,}')

def token_counts(s):return Counter(m.group(0) for m in PROTECTED.finditer(s))

def translate_preserving_tokens(text, from_lang, to_lang):
    import argostranslate.translate
    pieces=[]
    pos=0
    for m in PROTECTED.finditer(text):
        fragment=text[pos:m.start()]
        if fragment.strip():
            pieces.append(argostranslate.translate.translate(fragment,from_lang,to_lang))
        else:
            pieces.append(fragment)
        pieces.append(m.group(0))
        pos=m.end()
    ending=text[pos:]
    pieces.append(argostranslate.translate.translate(ending,from_lang,to_lang) if ending.strip() else ending)
    return ''.join(pieces).strip()

def setup_models():
    import argostranslate.package
    argostranslate.package.update_package_index()
    packages=argostranslate.package.get_available_packages()
    for lang in ('ru','zh'):
        choices=[p for p in packages if p.from_code=='en' and p.to_code==lang]
        if not choices:
            raise RuntimeError('Argos package missing for en -> '+lang)
        package=choices[0]
        print('Installing NMT model en ->',lang,'model_version',getattr(package,'package_version','unknown'),flush=True)
        path=package.download()
        argostranslate.package.install_from_path(path)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--existing',action='append',default=[],
                        help='Persisted draft JSON; may specify multiple batches')
    parser.add_argument('--limit',type=int,default=900,
                        help='Number of unique core-page strings to draft this run')
    args=parser.parse_args()
    source_path=CAT/'strings.json'
    if not source_path.is_file():raise SystemExit('No extracted inventory')
    catalog=json.loads(source_path.read_text(encoding='utf-8'))
    existing={}
    paths=args.existing or ['translations/drafts/core-batch-001.json','translations/drafts/core-batch-002.json']
    for item in paths:
        existing_path=ROOT/item
        if existing_path.is_file():
            obj=json.loads(existing_path.read_text(encoding='utf-8'))
            for identifier,values in obj.items():
                dest=existing.setdefault(identifier,{})
                for language in ('ru','zh-CN'):
                    if values.get(language):dest.setdefault(language,values[language])
            print('Loaded persisted draft batch:',item,'entries:',len(obj),flush=True)
    print('Combined persisted draft entries:',len(existing),flush=True)
    seeds=[]
    for identifier,entry in catalog.items():
        if not CORE_ROUTES.intersection(entry['routes']):continue
        source=entry['source']
        if not LATIN.search(source) or INVARIANT.fullmatch(source) or NO_TRANSLATE.match(source) or SPECIFICATION.match(source):continue
        if source.startswith(('http:','https:')) or len(source)>2000:continue
        if all(entry.get(locale) or existing.get(identifier,{}).get(locale)
               for locale in ('ru','zh-CN')):continue
        priority=min((0 if r in ('/domain-order/','/domain-pay/','/register/','/account/','/order/')
                      else 1 if r in ('/domains/','/vps/','/dedicated/','/gpu/') else 2)
                     for r in entry['routes'] if r in CORE_ROUTES)
        seeds.append((priority,len(source),identifier,entry))
    seeds.sort(key=lambda x:(x[0],x[1],x[2]))
    selected=seeds[:args.limit]
    print(f'Core strings pending: {len(seeds)}; selected for actual offline translation: {len(selected)}',flush=True)
    CAT.mkdir(exist_ok=True)
    report={'source_strings':len(catalog),'core_pending':len(seeds),
            'requested_strings':len(selected),'completed':{'ru':0,'zh-CN':0},
            'failed':[],'mode':'offline build-time Argos NMT drafts; not approved; not published'}
    draft={}
    try:
        setup_models()
        for index,(_,_,identifier,entry) in enumerate(selected,1):
            source=entry['source']
            result={}
            for locale,argos_code in (('ru','ru'),('zh-CN','zh')):
                if entry.get(locale) or existing.get(identifier,{}).get(locale):continue
                try:
                    value=translate_preserving_tokens(source,'en',argos_code)
                    if not value or value==source or token_counts(source)!=token_counts(value):
                        raise ValueError('untranslated or protected token mismatch')
                    if '<script' in value.lower() or '</' in value or '\x00' in value:
                        raise ValueError('unsafe translation output')
                    result[locale]=value
                    report['completed'][locale]+=1
                except Exception as err:
                    report['failed'].append({'id':identifier,'locale':locale,'reason':str(err)[:180]})
            if result:draft[identifier]=result
            if index%100==0:print('Translated',index,'/',len(selected),flush=True)
    except Exception as exc:
        report['setup_error']=repr(exc)
        raise
    finally:
        (CAT/'draft-translations.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (CAT/'draft-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Draft report:',json.dumps({k:v for k,v in report.items() if k!='failed'},ensure_ascii=False),flush=True)
    if not draft:
        print('NO NEW DRAFTS: translation engine could not improve remaining strings.')
        print('All failures are recorded in draft-report.json for manual correction.')
        return
    print('SUCCESS: saved offline NMT draft, review required before static publication')

if __name__=='__main__':main()
)
NO_TRANSLATE=re.compile(r'^\s*(?:https?://|/[A-Za-z0-9_/?=&.-]+)\s*
LATIN=re.compile(r'[A-Za-z]{2,}')

def token_counts(s):return Counter(m.group(0) for m in PROTECTED.finditer(s))

def translate_preserving_tokens(text, from_lang, to_lang):
    import argostranslate.translate
    pieces=[]
    pos=0
    for m in PROTECTED.finditer(text):
        fragment=text[pos:m.start()]
        if fragment.strip():
            pieces.append(argostranslate.translate.translate(fragment,from_lang,to_lang))
        else:
            pieces.append(fragment)
        pieces.append(m.group(0))
        pos=m.end()
    ending=text[pos:]
    pieces.append(argostranslate.translate.translate(ending,from_lang,to_lang) if ending.strip() else ending)
    return ''.join(pieces).strip()

def setup_models():
    import argostranslate.package
    argostranslate.package.update_package_index()
    packages=argostranslate.package.get_available_packages()
    for lang in ('ru','zh'):
        choices=[p for p in packages if p.from_code=='en' and p.to_code==lang]
        if not choices:
            raise RuntimeError('Argos package missing for en -> '+lang)
        package=choices[0]
        print('Installing NMT model en ->',lang,'model_version',getattr(package,'package_version','unknown'),flush=True)
        path=package.download()
        argostranslate.package.install_from_path(path)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--existing',action='append',default=[],
                        help='Persisted draft JSON; may specify multiple batches')
    parser.add_argument('--limit',type=int,default=900,
                        help='Number of unique core-page strings to draft this run')
    args=parser.parse_args()
    source_path=CAT/'strings.json'
    if not source_path.is_file():raise SystemExit('No extracted inventory')
    catalog=json.loads(source_path.read_text(encoding='utf-8'))
    existing={}
    paths=args.existing or ['translations/drafts/core-batch-001.json','translations/drafts/core-batch-002.json']
    for item in paths:
        existing_path=ROOT/item
        if existing_path.is_file():
            obj=json.loads(existing_path.read_text(encoding='utf-8'))
            for identifier,values in obj.items():
                dest=existing.setdefault(identifier,{})
                for language in ('ru','zh-CN'):
                    if values.get(language):dest.setdefault(language,values[language])
            print('Loaded persisted draft batch:',item,'entries:',len(obj),flush=True)
    print('Combined persisted draft entries:',len(existing),flush=True)
    seeds=[]
    for identifier,entry in catalog.items():
        if not CORE_ROUTES.intersection(entry['routes']):continue
        source=entry['source']
        if not LATIN.search(source) or INVARIANT.fullmatch(source) or NO_TRANSLATE.match(source):continue
        if source.startswith(('http:','https:')) or len(source)>2000:continue
        if all(entry.get(locale) or existing.get(identifier,{}).get(locale)
               for locale in ('ru','zh-CN')):continue
        priority=min((0 if r in ('/domain-order/','/domain-pay/','/register/','/account/','/order/')
                      else 1 if r in ('/domains/','/vps/','/dedicated/','/gpu/') else 2)
                     for r in entry['routes'] if r in CORE_ROUTES)
        seeds.append((priority,len(source),identifier,entry))
    seeds.sort(key=lambda x:(x[0],x[1],x[2]))
    selected=seeds[:args.limit]
    print(f'Core strings pending: {len(seeds)}; selected for actual offline translation: {len(selected)}',flush=True)
    CAT.mkdir(exist_ok=True)
    report={'source_strings':len(catalog),'core_pending':len(seeds),
            'requested_strings':len(selected),'completed':{'ru':0,'zh-CN':0},
            'failed':[],'mode':'offline build-time Argos NMT drafts; not approved; not published'}
    draft={}
    try:
        setup_models()
        for index,(_,_,identifier,entry) in enumerate(selected,1):
            source=entry['source']
            result={}
            for locale,argos_code in (('ru','ru'),('zh-CN','zh')):
                if entry.get(locale) or existing.get(identifier,{}).get(locale):continue
                try:
                    value=translate_preserving_tokens(source,'en',argos_code)
                    if not value or value==source or token_counts(source)!=token_counts(value):
                        raise ValueError('untranslated or protected token mismatch')
                    if '<script' in value.lower() or '</' in value or '\x00' in value:
                        raise ValueError('unsafe translation output')
                    result[locale]=value
                    report['completed'][locale]+=1
                except Exception as err:
                    report['failed'].append({'id':identifier,'locale':locale,'reason':str(err)[:180]})
            if result:draft[identifier]=result
            if index%100==0:print('Translated',index,'/',len(selected),flush=True)
    except Exception as exc:
        report['setup_error']=repr(exc)
        raise
    finally:
        (CAT/'draft-translations.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (CAT/'draft-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Draft report:',json.dumps({k:v for k,v in report.items() if k!='failed'},ensure_ascii=False),flush=True)
    if not draft:
        print('NO NEW DRAFTS: translation engine could not improve remaining strings.')
        print('All failures are recorded in draft-report.json for manual correction.')
        return
    print('SUCCESS: saved offline NMT draft, review required before static publication')

if __name__=='__main__':main()
)
# Product model specifications and OS versions are identifiers, not prose.
# Translating these damages the original product names and parameters.
SPECIFICATION=re.compile(
    r'^(?:(?:Intel|AMD|NVIDIA|Xeon|EPYC|Ryzen|GeForce|RTX|GTX|Ubuntu|Debian|AlmaLinux|Rocky Linux|Windows Server|CentOS|Fedora|FreeBSD|Intel®|AMD®)[\s\S]*|'
    r'[\d]+\s*[×x]\s*(?:Intel|AMD|NVIDIA)[\s\S]*)$',
    re.I
)
LATIN=re.compile(r'[A-Za-z]{2,}')

def token_counts(s):return Counter(m.group(0) for m in PROTECTED.finditer(s))

def translate_preserving_tokens(text, from_lang, to_lang):
    import argostranslate.translate
    pieces=[]
    pos=0
    for m in PROTECTED.finditer(text):
        fragment=text[pos:m.start()]
        if fragment.strip():
            pieces.append(argostranslate.translate.translate(fragment,from_lang,to_lang))
        else:
            pieces.append(fragment)
        pieces.append(m.group(0))
        pos=m.end()
    ending=text[pos:]
    pieces.append(argostranslate.translate.translate(ending,from_lang,to_lang) if ending.strip() else ending)
    return ''.join(pieces).strip()

def setup_models():
    import argostranslate.package
    argostranslate.package.update_package_index()
    packages=argostranslate.package.get_available_packages()
    for lang in ('ru','zh'):
        choices=[p for p in packages if p.from_code=='en' and p.to_code==lang]
        if not choices:
            raise RuntimeError('Argos package missing for en -> '+lang)
        package=choices[0]
        print('Installing NMT model en ->',lang,'model_version',getattr(package,'package_version','unknown'),flush=True)
        path=package.download()
        argostranslate.package.install_from_path(path)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--existing',action='append',default=[],
                        help='Persisted draft JSON; may specify multiple batches')
    parser.add_argument('--limit',type=int,default=900,
                        help='Number of unique core-page strings to draft this run')
    args=parser.parse_args()
    source_path=CAT/'strings.json'
    if not source_path.is_file():raise SystemExit('No extracted inventory')
    catalog=json.loads(source_path.read_text(encoding='utf-8'))
    existing={}
    paths=args.existing or ['translations/drafts/core-batch-001.json','translations/drafts/core-batch-002.json']
    for item in paths:
        existing_path=ROOT/item
        if existing_path.is_file():
            obj=json.loads(existing_path.read_text(encoding='utf-8'))
            for identifier,values in obj.items():
                dest=existing.setdefault(identifier,{})
                for language in ('ru','zh-CN'):
                    if values.get(language):dest.setdefault(language,values[language])
            print('Loaded persisted draft batch:',item,'entries:',len(obj),flush=True)
    print('Combined persisted draft entries:',len(existing),flush=True)
    seeds=[]
    for identifier,entry in catalog.items():
        if not CORE_ROUTES.intersection(entry['routes']):continue
        source=entry['source']
        if not LATIN.search(source) or INVARIANT.fullmatch(source) or NO_TRANSLATE.match(source):continue
        if source.startswith(('http:','https:')) or len(source)>2000:continue
        if all(entry.get(locale) or existing.get(identifier,{}).get(locale)
               for locale in ('ru','zh-CN')):continue
        priority=min((0 if r in ('/domain-order/','/domain-pay/','/register/','/account/','/order/')
                      else 1 if r in ('/domains/','/vps/','/dedicated/','/gpu/') else 2)
                     for r in entry['routes'] if r in CORE_ROUTES)
        seeds.append((priority,len(source),identifier,entry))
    seeds.sort(key=lambda x:(x[0],x[1],x[2]))
    selected=seeds[:args.limit]
    print(f'Core strings pending: {len(seeds)}; selected for actual offline translation: {len(selected)}',flush=True)
    CAT.mkdir(exist_ok=True)
    report={'source_strings':len(catalog),'core_pending':len(seeds),
            'requested_strings':len(selected),'completed':{'ru':0,'zh-CN':0},
            'failed':[],'mode':'offline build-time Argos NMT drafts; not approved; not published'}
    draft={}
    try:
        setup_models()
        for index,(_,_,identifier,entry) in enumerate(selected,1):
            source=entry['source']
            result={}
            for locale,argos_code in (('ru','ru'),('zh-CN','zh')):
                if entry.get(locale) or existing.get(identifier,{}).get(locale):continue
                try:
                    value=translate_preserving_tokens(source,'en',argos_code)
                    if not value or value==source or token_counts(source)!=token_counts(value):
                        raise ValueError('untranslated or protected token mismatch')
                    if '<script' in value.lower() or '</' in value or '\x00' in value:
                        raise ValueError('unsafe translation output')
                    result[locale]=value
                    report['completed'][locale]+=1
                except Exception as err:
                    report['failed'].append({'id':identifier,'locale':locale,'reason':str(err)[:180]})
            if result:draft[identifier]=result
            if index%100==0:print('Translated',index,'/',len(selected),flush=True)
    except Exception as exc:
        report['setup_error']=repr(exc)
        raise
    finally:
        (CAT/'draft-translations.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (CAT/'draft-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Draft report:',json.dumps({k:v for k,v in report.items() if k!='failed'},ensure_ascii=False),flush=True)
    if not draft:
        print('NO NEW DRAFTS: translation engine could not improve remaining strings.')
        print('All failures are recorded in draft-report.json for manual correction.')
        return
    print('SUCCESS: saved offline NMT draft, review required before static publication')

if __name__=='__main__':main()
,
    re.I
)
LATIN=re.compile(r'[A-Za-z]{2,}')

def token_counts(s):return Counter(m.group(0) for m in PROTECTED.finditer(s))

def translate_preserving_tokens(text, from_lang, to_lang):
    import argostranslate.translate
    pieces=[]
    pos=0
    for m in PROTECTED.finditer(text):
        fragment=text[pos:m.start()]
        if fragment.strip():
            pieces.append(argostranslate.translate.translate(fragment,from_lang,to_lang))
        else:
            pieces.append(fragment)
        pieces.append(m.group(0))
        pos=m.end()
    ending=text[pos:]
    pieces.append(argostranslate.translate.translate(ending,from_lang,to_lang) if ending.strip() else ending)
    return ''.join(pieces).strip()

def setup_models():
    import argostranslate.package
    argostranslate.package.update_package_index()
    packages=argostranslate.package.get_available_packages()
    for lang in ('ru','zh'):
        choices=[p for p in packages if p.from_code=='en' and p.to_code==lang]
        if not choices:
            raise RuntimeError('Argos package missing for en -> '+lang)
        package=choices[0]
        print('Installing NMT model en ->',lang,'model_version',getattr(package,'package_version','unknown'),flush=True)
        path=package.download()
        argostranslate.package.install_from_path(path)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--existing',action='append',default=[],
                        help='Persisted draft JSON; may specify multiple batches')
    parser.add_argument('--limit',type=int,default=900,
                        help='Number of unique core-page strings to draft this run')
    args=parser.parse_args()
    source_path=CAT/'strings.json'
    if not source_path.is_file():raise SystemExit('No extracted inventory')
    catalog=json.loads(source_path.read_text(encoding='utf-8'))
    existing={}
    paths=args.existing or ['translations/drafts/core-batch-001.json','translations/drafts/core-batch-002.json']
    for item in paths:
        existing_path=ROOT/item
        if existing_path.is_file():
            obj=json.loads(existing_path.read_text(encoding='utf-8'))
            for identifier,values in obj.items():
                dest=existing.setdefault(identifier,{})
                for language in ('ru','zh-CN'):
                    if values.get(language):dest.setdefault(language,values[language])
            print('Loaded persisted draft batch:',item,'entries:',len(obj),flush=True)
    print('Combined persisted draft entries:',len(existing),flush=True)
    seeds=[]
    for identifier,entry in catalog.items():
        if not CORE_ROUTES.intersection(entry['routes']):continue
        source=entry['source']
        if not LATIN.search(source) or INVARIANT.fullmatch(source) or NO_TRANSLATE.match(source):continue
        if source.startswith(('http:','https:')) or len(source)>2000:continue
        if all(entry.get(locale) or existing.get(identifier,{}).get(locale)
               for locale in ('ru','zh-CN')):continue
        priority=min((0 if r in ('/domain-order/','/domain-pay/','/register/','/account/','/order/')
                      else 1 if r in ('/domains/','/vps/','/dedicated/','/gpu/') else 2)
                     for r in entry['routes'] if r in CORE_ROUTES)
        seeds.append((priority,len(source),identifier,entry))
    seeds.sort(key=lambda x:(x[0],x[1],x[2]))
    selected=seeds[:args.limit]
    print(f'Core strings pending: {len(seeds)}; selected for actual offline translation: {len(selected)}',flush=True)
    CAT.mkdir(exist_ok=True)
    report={'source_strings':len(catalog),'core_pending':len(seeds),
            'requested_strings':len(selected),'completed':{'ru':0,'zh-CN':0},
            'failed':[],'mode':'offline build-time Argos NMT drafts; not approved; not published'}
    draft={}
    try:
        setup_models()
        for index,(_,_,identifier,entry) in enumerate(selected,1):
            source=entry['source']
            result={}
            for locale,argos_code in (('ru','ru'),('zh-CN','zh')):
                if entry.get(locale) or existing.get(identifier,{}).get(locale):continue
                try:
                    value=translate_preserving_tokens(source,'en',argos_code)
                    if not value or value==source or token_counts(source)!=token_counts(value):
                        raise ValueError('untranslated or protected token mismatch')
                    if '<script' in value.lower() or '</' in value or '\x00' in value:
                        raise ValueError('unsafe translation output')
                    result[locale]=value
                    report['completed'][locale]+=1
                except Exception as err:
                    report['failed'].append({'id':identifier,'locale':locale,'reason':str(err)[:180]})
            if result:draft[identifier]=result
            if index%100==0:print('Translated',index,'/',len(selected),flush=True)
    except Exception as exc:
        report['setup_error']=repr(exc)
        raise
    finally:
        (CAT/'draft-translations.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (CAT/'draft-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Draft report:',json.dumps({k:v for k,v in report.items() if k!='failed'},ensure_ascii=False),flush=True)
    if not draft:
        print('NO NEW DRAFTS: translation engine could not improve remaining strings.')
        print('All failures are recorded in draft-report.json for manual correction.')
        return
    print('SUCCESS: saved offline NMT draft, review required before static publication')

if __name__=='__main__':main()
