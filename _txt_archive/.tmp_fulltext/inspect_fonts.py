# -*- coding: utf-8 -*-
import pymupdf, re, sys
sys.stdout.reconfigure(encoding='utf-8')

paths = {
    'GUO': r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\Guo 等 - 2024 - Large language model based multi-agents a survey of progress and challenges.pdf',
    'LI': r'C:\Users\lenovo\Zotero\storage\BACGW35G\Li 等 - 2024 - A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges.pdf',
}

for label, path in paths.items():
    doc = pymupdf.open(path)
    print('====', label, '====')
    for pno in range(min(6, doc.page_count)):
        page = doc[pno]
        d = page.get_text('dict')
        for block in d['blocks']:
            if block['type'] != 0:
                continue
            for line in block.get('lines', []):
                text = ''.join(span['text'] for span in line['spans']).strip()
                if not text:
                    continue
                sizes = sorted({round(span['size'], 1) for span in line['spans']})
                # print short lines only to find headings
                if len(text) < 90:
                    print(f'p{pno+1} y{line["bbox"][1]:.0f} size{max(sizes)}: {text!r}')
    doc.close()
