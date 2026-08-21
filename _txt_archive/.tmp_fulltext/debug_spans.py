# -*- coding: utf-8 -*-
import pymupdf
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def find_pdf(folder, pattern):
    hits = list(Path(folder).glob(pattern))
    return str(hits[0]) if hits else None


guo = find_pdf(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL', '*Guo*.pdf')
doc = pymupdf.open(guo)
page = doc[2]
d = page.get_text('dict')
for block in d['blocks']:
    if block['type'] != 0:
        continue
    lines = block.get('lines', [])
    first = ''.join(s['text'] for s in lines[0]['spans']).strip()
    if first != '2.2':
        continue
    for li, line in enumerate(lines[4:9], 4):
        print('LINE', li)
        for s in line['spans']:
            x0, y0, x1, y1 = s['bbox']
            print(f'  span size={s["size"]:.4f} bbox=({x0:.1f},{y0:.2f},{x1:.1f},{y1:.2f}) {s["text"]!r}')
doc.close()
