# -*- coding: utf-8 -*-
"""Export old Li Chinese paragraphs per section to JSON."""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def parse_old_md(path):
    lines = Path(path).read_text(encoding='utf-8').splitlines()
    sections = []
    cur = None
    in_appendix = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('>') or stripped.startswith('|') or stripped == '---':
            continue
        if stripped.startswith('#'):
            if '附录' in stripped:
                in_appendix = True
                continue
            if stripped.startswith('# ') or stripped.startswith('# 全文翻译'):
                continue
            cur = {'heading': stripped.lstrip('#').strip(), 'paras': []}
            sections.append(cur)
            continue
        if in_appendix or cur is None:
            continue
        if stripped:
            cur['paras'].append(stripped)
    return sections


def main():
    old = parse_old_md(r'C:\Users\lenovo\Desktop\A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges\LLM-Based_Multi-Agent_Systems_Survey_论文全文翻译.md')
    out = []
    for s in old:
        out.append({'heading': s['heading'], 'paras': s['paras']})
    Path(__file__).parent.joinpath('li_old_zh.json').write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print('sections', len(out), 'paras', sum(len(s['paras']) for s in out))


if __name__ == '__main__':
    main()
