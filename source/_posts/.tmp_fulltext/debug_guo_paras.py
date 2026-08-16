# -*- coding: utf-8 -*-
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
base = r'G:\hexo\my-blog\source\_posts\.tmp_fulltext'
with open(base + '\\guo_sections_v2.json', encoding='utf-8') as f:
    data = json.load(f)
for s in data['sections']:
    if s['heading'] in ('2 Background','4.1 LLM-MA for Problem Solving','4.1.1 Software Development','4.2.4 Economy','5 Implementation Tools and Resources'):
        print('====', s['heading'])
        for i, p in enumerate(s['paragraphs']):
            print(i, repr(p[:300]))
            if i >= 14:
                print('... (more)')
                break
