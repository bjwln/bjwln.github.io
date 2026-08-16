# -*- coding: utf-8 -*-
import sys, glob
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\BACGW35G\*Li*.pdf')[0]
doc = pymupdf.open(path)
for pno in [5,6,27,28]:
    page = doc[pno-1]
    print('==== page', pno)
    txt = page.get_text('text')
    print(txt[:3000])
    print('...len', len(txt))
doc.close()
