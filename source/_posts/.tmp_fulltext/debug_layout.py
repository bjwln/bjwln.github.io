# -*- coding: utf-8 -*-
import pymupdf
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def find_pdf(folder, pattern):
    hits = list(Path(folder).glob(pattern))
    return str(hits[0]) if hits else None


paths = {
    'GUO': find_pdf(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL', '*Guo*.pdf'),
    'LI': find_pdf(r'C:\Users\lenovo\Zotero\storage\BACGW35G', '*Li*.pdf'),
}


def line_text(line):
    return ''.join(s['text'] for s in line['spans'])


for label, path in paths.items():
    doc = pymupdf.open(path)
    print('=====', label, 'pages', len(doc))
    pages = [3] if label == 'GUO' else [3, 21]
    for pno in pages:
        page = doc[pno - 1]
        d = page.get_text('dict')
        print('--- page', pno, 'width', page.rect.width, 'height', page.rect.height)
        for bi, block in enumerate(d['blocks']):
            if block['type'] != 0:
                continue
            x0, y0, x1, y1 = block['bbox']
            lines = block.get('lines', [])
            first = line_text(lines[0]).strip() if lines else ''
            print(f'block {bi}: bbox=({x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}) nlines={len(lines)} first={first[:60]!r}')
            for li, line in enumerate(lines[:12]):
                txt = line_text(line).strip()
                if not txt:
                    continue
                sizes = [round(s['size'], 4) for s in line['spans']]
                bx0, by0, bx1, by1 = line['bbox']
                print(f'  line {li}: y=({by0:.2f},{by1:.2f}) h={by1-by0:.2f} sizes={sizes[:4]} text={txt[:80]!r}')
    doc.close()
