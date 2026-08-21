# -*- coding: utf-8 -*-
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

base = Path(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext')
for name in ('guo_sections_v2.json', 'li_sections_v2.json'):
    data = json.loads((base / name).read_text(encoding='utf-8'))
    print('=====', name, '=====')
    print('FRONT:', len(data['front']))
    for s in data['sections']:
        if s['heading'] in ('3.1 Agents-Environment Interface', '4.1 LLM-MA for Problem Solving',
                            'Abstract', 'References'):
            print('---', s['heading'], 'paras:', len(s['paragraphs']))
            for p in s['paragraphs'][:2]:
                print('   ', p[:300].replace('\n', ' '))
            print('    ...')
    print()
