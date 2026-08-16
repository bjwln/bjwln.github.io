# -*- coding: utf-8 -*-
import io, sys
from pdfplumber import open as pdf_open

paths = {
    'LI': r'C:\Users\lenovo\Zotero\storage\BACGW35G\Li 等 - 2024 - A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges.pdf',
    'GUO': r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\Guo 等 - 2024 - Large language model based multi-agents a survey of progress and challenges.pdf',
}

out = io.StringIO()
for label, path in paths.items():
    out.write('=== %s ===\n' % label)
    with pdf_open(path) as pdf:
        out.write('pages: %d\n' % len(pdf.pages))
        for pno, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            if tables:
                for ti, table in enumerate(tables):
                    out.write('page %d table %d rows %d\n' % (pno, ti, len(table)))
                    for row in table:
                        cells = []
                        for c in row:
                            c = (c or '').replace('\n', ' | ')
                            cells.append(c)
                        out.write('ROW\t' + '\t'.join(cells) + '\n')
    out.write('\n')
with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\tables_full.txt', 'w', encoding='utf-8') as f:
    f.write(out.getvalue())
