# -*- coding: utf-8 -*-
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

path = Path(r'C:\Users\lenovo\Desktop\A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges\LLM-Based_Multi-Agent_Systems_Survey_论文全文翻译.md')
lines = path.read_text(encoding='utf-8').splitlines()
for i, line in enumerate(lines[:120]):
    print(i, repr(line))
