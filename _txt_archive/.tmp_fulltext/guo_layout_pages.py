# -*- coding: utf-8 -*-
import sys, glob
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf')[0]
doc = pymupdf.open(path)
for pno in [6,9]:
    page = doc[pno-1]
    d = page.get_text('dict')
    print('==== page', pno)
    for bi, b in enumerate(d['blocks']):
        if b['type'] != 0: continue
        txt = ' '.join(s['text'] for l in b['lines'] for s in l['spans'])
        txt = ' '.join(txt.split())
        print(bi, 'bbox', [round(x,1) for x in b['bbox']], repr(txt[:100]))
doc.close()
