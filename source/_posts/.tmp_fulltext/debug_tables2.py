# -*- coding: utf-8 -*-
import sys, glob, time
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf')[0]
doc = pymupdf.open(path)
print('FILE', path, 'pages', doc.page_count)
t0=time.time()
for pno in [4,5,6,7]:
    page = doc[pno-1]
    tabs = page.find_tables()
    print(' page', pno, 'tables', len(tabs.tables), 'elapsed', round(time.time()-t0,1))
    for t in tabs.tables:
        print('   bbox', [round(x,1) for x in t.bbox])
doc.close()
