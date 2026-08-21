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
                # print 摘要 and 1 引言 body
                start=None; end=None
                for i,ln in enumerate(lines):
                    if ln.strip()=='## 摘要': start=i
                    if ln.strip()=='## 1 引言': end=i; break
                print('ABSTRACT (lines %d..%d)'%(start,end))
                print('\n'.join(lines[start+1:end]))
                print('====='*8)
                start=None; end=None
                for i,ln in enumerate(lines):
                    if ln.strip()=='### 2.1 单智能体（Single Agent）': start=i
                    if ln.strip()=='### 2.2 多智能体（Multi Agents）': end=i; break
                print('2.1 (lines %d..%d)'%(start,end))
                print('\n'.join(lines[start+1:end]))
