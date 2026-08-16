# -*- coding: utf-8 -*-
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).parent


def heading_level(line):
    return len(line) - len(line.lstrip('#'))


def parse_old_md(path):
    """Parse the old full-translation markdown into sections with Chinese paragraphs."""
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
            if stripped.startswith('# 全文翻译'):
                continue
            cur = {'heading': stripped.lstrip('#').strip(), 'paras': []}
            sections.append(cur)
            continue
        if in_appendix:
            continue
        if cur is None:
            continue
        if stripped:
            cur['paras'].append(stripped)
    return sections


def main():
    old = parse_old_md(r'C:\Users\lenovo\Desktop\A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges\LLM-Based_Multi-Agent_Systems_Survey_论文全文翻译.md')
    data = json.load(open(ROOT / 'li_sections_v2.json', encoding='utf-8'))

    def norm(h):
        h = re.sub(r'[^\w\s.-]', '', h)
        return h.strip().lower()

    def secnum(h):
        m = re.search(r'(\d+(?:\.\d+)*)', h.strip())
        return m.group(1) if m else None

    old_by_num = {}
    for s in old:
        n = secnum(s['heading'])
        if n:
            old_by_num[n] = s
    for sec in data['sections']:
        n = secnum(sec['heading'])
        match = old_by_num.get(n)
        en_n = sum(1 for p in sec['paragraphs'] if p.strip())
        zh_n = len(match['paras']) if match else 0
        print(f"{sec['heading'][:55]:55s} en={en_n:3d} zh={zh_n:3d} match={match['heading'] if match else 'NONE'}")


if __name__ == '__main__':
    main()
