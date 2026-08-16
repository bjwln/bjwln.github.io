# -*- coding: utf-8 -*-
import pymupdf
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def find_pdf(folder, pattern):
    hits = list(Path(folder).glob(pattern))
    return str(hits[0]) if hits else None


paths = {
    'GUO': find_pdf(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL', '*Guo*.pdf'),
    'LI': find_pdf(r'C:\Users\lenovo\Zotero\storage\BACGW35G', '*Li*.pdf'),
}
print(paths)


def line_text(line):
    return ''.join(s['text'] for s in line['spans'])


for label, path in paths.items():
    doc = pymupdf.open(path)
    print('=====', label, 'pages', len(doc))
    shown = 0
    for pno in range(1, len(doc) + 1):
        page = doc[pno - 1]
        d = page.get_text('dict')
        for block in d['blocks']:
            if block['type'] != 0:
                continue
            for line in block.get('lines', []):
                txt = line_text(line).strip()
                if not txt:
                    continue
                size = max(s['size'] for s in line['spans'])
                if size >= 9.0 and (
                    re.match(r'^\d+(\.\d+)*\s', txt)
                    or txt in ('Abstract', 'References', 'Acknowledgements', 'Conclusion',
                               'Introduction', 'Background')
                ):
                    print(label, 'p' + str(pno), round(size, 2), repr(txt[:110]))
                    shown += 1
    print(label, 'heading-like lines shown:', shown)
    doc.close()
