# -*- coding: utf-8 -*-
import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
base = r'G:\hexo\my-blog\source\_posts\.tmp_fulltext'
for name in ['guo_sections_v2.json','li_sections_v2.json']:
    with open(base + '\\' + name, encoding='utf-8') as f:
        data = json.load(f)
    print('====', name)
    for s in data['sections']:
        h = s['heading']
        if h in ('Abstract','References'):
            print(' ', repr(h), 'paras', len(s['paragraphs']))
            continue
        # heading patterns: for Guo check 2.1/5.1/4.1.1; for Li check 2.1/3.2
        print(' ', repr(h), 'paras', len(s['paragraphs']))
