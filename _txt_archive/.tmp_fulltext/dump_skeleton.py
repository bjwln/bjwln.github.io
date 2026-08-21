# -*- coding: utf-8 -*-
"""Dump skeleton paragraph ids with English text for manual mapping."""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).parent
label = sys.argv[1] if len(sys.argv) > 1 else 'LI'


def main():
    data = json.load(open(ROOT / f'{label.lower()}_sections_v2.json', encoding='utf-8'))
    pid = 0
    out = []
    for sec in data['sections']:
        h = sec['heading']
        out.append(f'## SECTION {h}  (slot pid starts {pid})')
        if h == 'Declarations':
            paras = sec['paragraphs']
            split = next((i for i, p in enumerate(paras) if p.startswith('References')), None)
            decl = paras if split is None else paras[:split]
            refs = [] if split is None else paras[split:]
            out.append('  D:' + str(len(decl)) + ' R:' + str(len(refs)))
            for p in decl:
                if p.strip():
                    out.append(f'D{pid}: {p[:150]}')
                    pid += 1
            for p in refs:
                if p.strip():
                    out.append(f'R{pid}: {p[:150]}')
                    pid += 1
            continue
        out.append(f'  H{pid}: {h}')
        pid += 1
        for p in sec['paragraphs']:
            if not p.strip():
                continue
            out.append(f'B{pid}: {p[:160]}')
            pid += 1
    out_path = ROOT / f'{label.lower()}_skeleton_dump.txt'
    out_path.write_text('\n'.join(out), encoding='utf-8')
    print(out_path)


if __name__ == '__main__':
    main()
