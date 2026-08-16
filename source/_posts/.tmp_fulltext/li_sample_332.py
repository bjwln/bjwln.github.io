# -*- coding: utf-8 -*-
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
desk = Path(r'C:\Users\lenovo\Desktop')
for d in desk.iterdir():
    if d.is_dir() and d.name.startswith('A survey'):
        for f in d.iterdir():
            if '全文翻译' in f.name:
                t = f.read_text(encoding='utf-8')
                lines = t.splitlines()
                # find section 3.3.2
                start=end=None
                for i,ln in enumerate(lines):
                    s=ln.strip()
                    if s.startswith('#### 3.3.2'): start=i
                    if s.startswith('#### 3.3.3'): end=i; break
                body='\n'.join(lines[start+1:end])
                print(body[:3500])
