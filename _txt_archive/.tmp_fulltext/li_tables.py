# -*- coding: utf-8 -*-
import sys, glob
sys.stdout.reconfigure(encoding='utf-8')
from pdfplumber import open as pdf_open
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\BACGW35G\*Li*.pdf')[0]
with pdf_open(path) as pdf:
    print('pages', len(pdf.pages))
    for pno, page in enumerate(pdf.pages, 1):
        tables = page.extract_tables()
        if tables:
            print('PAGE', pno, 'tables', len(tables))
            for ti, table in enumerate(tables):
                print('  table', ti, 'rows', len(table))
                for row in table[:8]:
                    print('   ROW', [ (c or '').replace('\n',' | ') for c in row])
