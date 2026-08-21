# -*- coding: utf-8 -*-
import pymupdf
import sys
sys.stdout.reconfigure(encoding='utf-8')

paths = {
    'GUO': r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\Guo 等 - 2024 - Large language model based multi-agents a survey of progress and challenges.pdf',
    'LI': r'C:\Users\lenovo\Zotero\storage\BACGW35G\Li 等 - 2024 - A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges.pdf',
}
doc = pymupdf.open(paths['LI'])
print('LI pages:', doc.page_count)
for pno in [0, 1, 2]:
    page = doc[pno]
    blocks = page.get_text('blocks', sort=True)
    print(f'--- LI page {pno+1}: {len(blocks)} blocks, page size {page.rect}')
    for b in blocks:
        x0, y0, x1, y1, text, bno, btype = b
        print(f'[{bno}] ({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f}) type={btype}: {text[:200]!r}')
doc.close()
