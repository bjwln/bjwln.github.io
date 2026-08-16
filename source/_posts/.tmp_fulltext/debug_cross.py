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
txt = page.get_text('text')

# Find the occurrence near "Conversely"
pos = txt.find('Conversely')
print('RAW TEXT around Conversely:')
print(repr(txt[pos - 120:pos + 160]))

print()
print('WORDS around y=360..380, x=50..300:')
for w in page.get_text('words'):
    x0, y0, x1, y1, word, *_ = w
    if 355 <= y0 <= 385 and x0 < 310:
        print(f'({x0:.1f},{y0:.2f},{x1:.1f},{y1:.2f}) {word!r}')

# Also use xhtml which preserves more layout info
html = page.get_text('xhtml')
i = html.find('Conversely')
print()
print('XHTML around Conversely (first 900 chars):')
print(html[max(0, i - 700):i + 200])
doc.close()
