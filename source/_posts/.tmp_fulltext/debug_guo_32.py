# -*- coding: utf-8 -*-
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\guo_sections_v2.json', encoding='utf-8') as f:
    data = json.load(f)
for s in data['sections']:
    if s['heading'].startswith('1 lists'):
        print('HEAD', repr(s['heading']))
        for i,p in enumerate(s['paragraphs']):
            print(i, repr(p[:500]))
    if s['heading'] == '3.2 Agents Profiling':
        print('==== 3.2')
        for i,p in enumerate(s['paragraphs']):
            print(i, repr(p[:500]))
