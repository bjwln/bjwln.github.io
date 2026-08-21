# -*- coding: utf-8 -*-
from pdfplumber import open as pdf_open

paths = {
    'LI': r'C:\Users\lenovo\Zotero\storage\BACGW35G\Li 等 - 2024 - A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges.pdf',
    'GUO': r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\Guo 等 - 2024 - Large language model based multi-agents a survey of progress and challenges.pdf',
}

for label, path in paths.items():
    print('===', label, '===')
    with pdf_open(path) as pdf:
        for pno in [0, 1, 2, 3, 4]:
            page = pdf.pages[pno]
            words = page.extract_words()
            xs = sorted(set(round(w['x0'] / 5) * 5 for w in words))
            # 简单聚类
            clusters = []
            cur = [xs[0]]
            for a, b in zip(xs, xs[1:]):
                if b - a >= 25:
                    clusters.append(cur)
                    cur = [b]
                else:
                    cur.append(b)
            clusters.append(cur)
            print('page', pno + 1, 'width', page.width, 'x0 clusters', [(min(c), max(c), len(c)) for c in clusters])
            for w in words[:5]:
                print('  word', w['text'], round(w['x0'], 1), round(w['x1'], 1), round(w['top'], 1))
