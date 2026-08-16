# -*- coding: utf-8 -*-
import sys, glob, time
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\BACGW35G\*Li*.pdf')[0]
doc = pymupdf.open(path)
t0=time.time()
for pno in [5,6,27]:
    page = doc[pno-1]
    tabs = page.find_tables()
    print('page', pno, 'tables', len(tabs.tables), 'elapsed', round(time.time()-t0,2))
    for t in tabs.tables:
        print('   bbox', [round(x,1) for x in t.bbox], 'rows', len(t.extract()), 'cols', len(t.extract()[0]) if t.extract() else 0)
doc.close()
