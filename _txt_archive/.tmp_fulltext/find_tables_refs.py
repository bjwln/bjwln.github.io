# -*- coding: utf-8 -*-
import sys, glob, re
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
for pat, name in [(r'C:\Users\lenovo\Zotero\storage\BACGW35G\*Li*.pdf','LI'), (r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf','GUO')]:
    path = glob.glob(pat)[0]
    doc = pymupdf.open(path)
    print('====', name)
    for pno, page in enumerate(doc, 1):
        text = page.get_text('text')
        if 'Table' in text or '表' in text:
            # find lines mentioning Table
            hits = [ln for ln in text.splitlines() if re.search(r'Table\s*\d|表\s*\d', ln)]
            if hits:
                print(' page', pno, hits[:6])
    doc.close()
