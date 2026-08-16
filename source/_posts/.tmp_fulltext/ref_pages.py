# -*- coding: utf-8 -*-
import sys, glob
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
for pat,label in [(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf','GUO'),(r'C:\Users\lenovo\Zotero\storage\BACGW35G\*Li*.pdf','LI')]:
    doc = pymupdf.open(glob.glob(pat)[0])
    print('====', label, 'pages', doc.page_count)
    # Guo refs start page 12; Li refs pages 38-43 roughly; print last 4 pages start
    for pno in range(doc.page_count-3, doc.page_count+1):
        text = doc[pno-1].get_text('text')
        print('PAGE', pno, repr(text[:400]))
    doc.close()
