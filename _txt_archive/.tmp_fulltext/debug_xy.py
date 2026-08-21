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

print('--- GUO page 2 raw tail ---')
print(doc[1].get_text('text')[-1500:])

print('--- GUO page 2 heading-like lines ---')
for pno in (2,):
    page = doc[pno - 1]
    d = page.get_text('dict')
    for block in d['blocks']:
        if block['type'] != 0:
            continue
        for line in block.get('lines', []):
            txt = ''.join(s['text'] for s in line['spans']).strip()
            if not txt:
                continue
            size = max(s['size'] for s in line['spans'])
            if size >= 9.5:
                x0, y0, x1, y1 = line['bbox']
                print(f'p{pno} size={size:.4f} bbox=({x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}) {txt[:90]!r}')

print('--- GUO page 3 block 3 lines 4-9 with x ---')
page = doc[2]
d = page.get_text('dict')
for block in d['blocks']:
    if block['type'] != 0:
        continue
    lines = block.get('lines', [])
    first = ''.join(s['text'] for s in lines[0]['spans']).strip()
    if first != '2.2':
        continue
    for li, line in enumerate(lines):
        txt = ''.join(s['text'] for s in line['spans']).strip()
        x0, y0, x1, y1 = line['bbox']
        size = max(s['size'] for s in line['spans'])
        print(f'line {li}: size={size:.4f} bbox=({x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}) {txt[:90]!r}')

doc.close()
