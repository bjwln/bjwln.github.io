# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
desk = Path(r'C:\Users\lenovo\Desktop')
for d in desk.iterdir():
    if d.is_dir() and d.name.startswith('A survey'):
        for f in d.iterdir():
            if '全文翻译' in f.name:
                t = f.read_text(encoding='utf-8')
                lines = t.splitlines()
                print('FILE', f.name, 'lines', len(lines))
                # print lines that look like headings (## or ###)
                for i, ln in enumerate(lines):
                    s = ln.strip()
                    if s.startswith('#') and not s.startswith('#>'):
                        print(i, repr(s[:130]))
