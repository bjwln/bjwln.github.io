# -*- coding: utf-8 -*-
import sys, glob
sys.stdout.reconfigure(encoding='utf-8')
from pdfplumber import open as pdf_open
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf')[0]
with pdf_open(path) as pdf:
    for pno, page in enumerate(pdf.pages, 1):
        tables = page.extract_tables()
        if tables:
            print('PAGE', pno)
            for ti, table in enumerate(tables):
                print(' table', ti, 'rows', len(table), 'cols', len(table[0]) if table else 0)
                print(' bbox', page.bbox if hasattr(page,'bbox') else '')
                # print first row
                for row in table[:3]:
                    print('   ROW', [(c or '').replace('\n',' | ')[:80] for c in row])
