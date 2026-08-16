# -*- coding: utf-8 -*-
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\li_sections_v2.json', encoding='utf-8') as f:
    data = json.load(f)
for s in data['sections']:
    if s['heading'] in ('3.1.2 Generation strategy', '3.2.2 Message type'):
        print('====', s['heading'])
        for i, p in enumerate(s['paragraphs']):
            if any(ch in p for ch in ['\t', 'Work', 'Object']):
                print(i, repr(p[:160]))
            if i < 6:
                print(i, repr(p[:160]))
