# -*- coding: utf-8 -*-
import pymupdf
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def find_pdf(folder, pattern):
    hits = list(Path(folder).glob(pattern))
    return str(hits[0]) if hits else None


for label, folder, pat, pno in (
    ('GUO', r'C:\Users\lenovo\Zotero\storage\N2N2YYQL', '*Guo*.pdf', 3),
    ('LI', r'C:\Users\lenovo\Zotero\storage\BACGW35G', '*Li*.pdf', 3),
):
    path = find_pdf(folder, pat)
    doc = pymupdf.open(path)
    txt = doc[pno - 1].get_text('text')
    print(f'===== {label} page {pno} raw =====')
    print(txt[:3000])
    print('===== END =====')
    doc.close()
