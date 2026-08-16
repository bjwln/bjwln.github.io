# -*- coding: utf-8 -*-
import pymupdf
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def find_pdf(folder, pattern):
    hits = list(Path(folder).glob(pattern))
    return str(hits[0]) if hits else None


guo = find_pdf(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL', '*Guo*.pdf')
doc = pymupdf.open(guo)
page = doc[2]
mat = pymupdf.Matrix(4, 4)
pix = page.get_pixmap(matrix=mat, clip=pymupdf.Rect(40, 350, 310, 395))
pix.save(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\guo_p3_region.png')

txt = page.get_text('text')
i = txt.find('environment.')
print(repr(txt[i - 80:i + 120]))
doc.close()
