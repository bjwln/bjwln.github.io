# -*- coding: utf-8 -*-
import sys, glob
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
for pat in [r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf', r'C:\Users\lenovo\Zotero\storage\BACGW35G\*Li*.pdf']:
    path = glob.glob(pat)[0]
    doc = pymupdf.open(path)
    print('FILE', path)
    for pno, page in enumerate(doc, 1):
        tabs = page.find_tables()
        if tabs.tables:
            print(' page', pno, 'tables', len(tabs.tables), 'bboxes', [t.bbox for t in tabs.tables])
    doc.close()
