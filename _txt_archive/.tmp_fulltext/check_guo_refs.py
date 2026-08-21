# -*- coding: utf-8 -*-
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\guo_sections_v2.json', encoding='utf-8') as f:
    data = json.load(f)
for s in data['sections']:
    if s['heading'] == 'References':
        print('count', len(s['paragraphs']))
        for i,p in enumerate(s['paragraphs']):
            print(i, repr(p[:180]))
            if i>=8: break
        print('...last...')
        for i,p in enumerate(s['paragraphs'][-5:]):
            print(len(s['paragraphs'])-5+i, repr(p[:180]))
