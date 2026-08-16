# -*- coding: utf-8 -*-
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

data = json.load(open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\li_old_zh.json', encoding='utf-8'))
for s in data:
    print(s['heading'], '|', len(s['paras']))
    for i, p in enumerate(s['paras']):
        print('   ', i, p[:80])
