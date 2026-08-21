# -*- coding: utf-8 -*-
import sys, glob, json
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
# Li references pages 38-43
path = glob.glob(r'C:\Users\lenovo\Zotero\storage\BACGW35G\*Li*.pdf')[0]
doc = pymupdf.open(path)
out = []
for pno in range(38, 44):
    t = doc[pno-1].get_text('text')
    out.append(f'<!-- page {pno} -->\n' + t)
doc.close()
with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\li_refs_raw.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('li refs chars', sum(len(x) for x in out))
# Guo references pages 11-15 (check page 11)
path2 = glob.glob(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\*Guo*.pdf')[0]
doc2 = pymupdf.open(path2)
out2 = []
for pno in range(11, 16):
    t = doc2[pno-1].get_text('text')
    out2.append(f'<!-- page {pno} -->\n' + t)
doc2.close()
with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\guo_refs_raw.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out2))
print('guo refs chars', sum(len(x) for x in out2))
print('GUO p11 first:', repr(out2[0][:500]))
