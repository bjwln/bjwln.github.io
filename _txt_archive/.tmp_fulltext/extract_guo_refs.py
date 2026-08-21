# -*- coding: utf-8 -*-
import sys, glob, re
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf')[0]
doc = pymupdf.open(path)
out = []
for pno in range(12, 16):
    out.append(f'<!-- page {pno} -->\n' + doc[pno-1].get_text('text'))
doc.close()
with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\guo_refs_raw.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('chars', sum(len(x) for x in out), 'pages', len(out))
print(repr(out[0][:300]))
