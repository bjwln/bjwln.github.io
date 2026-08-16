# -*- coding: utf-8 -*-
import re
import sys
import pymupdf

sys.path.insert(0, r'G:\hexo\my-blog\source\_posts\.tmp_fulltext')
sys.stdout.reconfigure(encoding='utf-8')

import extract_v2 as ex

label = 'GUO'
doc = pymupdf.open(ex.PDFS[label])
for pno in range(1, len(doc) + 1):
    page = doc[pno - 1]
    d = page.get_text('dict')
    for block in d['blocks']:
        if block['type'] != 0:
            continue
        for line in block.get('lines', []):
            info = ex.line_parts(line)
            if info is None or ex.noise_text(info['text'], label, pno):
                continue
            t = info['text']
            if re.match(r'^\d+(\.\d+)*\s*$', t):
                flags = [s['flags'] for s in line['spans']]
                font = [s['font'] for s in line['spans']]
                print(f'p{pno} size={info["size"]:.4f} flags={flags[:2]} font={font[:2]} num={t!r}')
doc.close()
