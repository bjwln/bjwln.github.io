# -*- coding: utf-8 -*-
import sys
import pymupdf

sys.path.insert(0, r'G:\hexo\my-blog\source\_posts\.tmp_fulltext')
sys.stdout.reconfigure(encoding='utf-8')

import extract_v2 as ex

label = 'GUO'
doc = pymupdf.open(ex.PDFS[label])
for pno in (3, 8):
    page = doc[pno - 1]
    units, page_w, page_h = ex.collect_units(label, page, pno)
    ordered = ex.order_units(units, page_w, page_h)
    print(f'===== GUO page {pno}: {len(ordered)} units =====')
    for idx, u in enumerate(ordered):
        lines = ex.merge_same_baseline(u['lines'])
        lines.sort(key=lambda l: (l['y0'], l['x0']))
        first = lines[0]['text'][:70] if lines else ''
        head = None
        i = 0
        while i < len(lines):
            h = ex.is_heading_line(lines[i], label)
            if h:
                head = h
                break
            i += 1
        body = lines[i:]
        blen = len(ex.join_para_lines(body)) if body else 0
        x0, y0, x1, y1 = u['bbox']
        print(f'u{idx}: bbox=({x0:.0f},{y0:.0f},{x1:.0f},{y1:.0f}) head={head!r} bodylen={blen} first={first!r}')
doc.close()
