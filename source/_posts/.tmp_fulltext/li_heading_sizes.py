# -*- coding: utf-8 -*-
import sys, re, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
desk = Path(r'C:\Users\lenovo\Desktop')
for d in desk.iterdir():
    if d.is_dir() and d.name.startswith('A survey'):
        for f in d.iterdir():
            if '全文翻译' in f.name:
                t = f.read_text(encoding='utf-8')
                lines = t.splitlines()
                # collect section headings and char counts of body between
                hs=[]
                for i,ln in enumerate(lines):
                    s=ln.strip()
                    if re.match(r'^#{2,4}\s', s):
                        hs.append((i,s))
                for j,(i,s) in enumerate(hs):
                    end = hs[j+1][0] if j+1 < len(hs) else len(lines)
                    body = '\n'.join(lines[i+1:end]).strip()
                    print(f'{j:3d} L{i:3d} chars={len(body):5d}  {s[:90]}')
