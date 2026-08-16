# -*- coding: utf-8 -*-
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

for path in [
    Path(r'C:\Users\lenovo\Desktop\A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges\LLM-Based_Multi-Agent_Systems_Survey_论文全文翻译.md'),
    Path(r'C:\Users\lenovo\Desktop\Large language model based multi-agents a survey of progress and challenges\Large_Language_Model_Based_Multi-Agents_论文全文翻译.md'),
]:
    print('====', path.name, '====')
    for i, line in enumerate(path.read_text(encoding='utf-8').splitlines()):
        if line.startswith('#'):
            print(i, line)
