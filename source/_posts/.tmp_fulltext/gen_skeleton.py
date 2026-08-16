# -*- coding: utf-8 -*-
"""Generate bilingual markdown skeletons with {{ZH:...}} translation slots."""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).parent

TITLES = {
    'GUO': {
        'title_en': 'Large Language Model based Multi-Agents: A Survey of Progress and Challenges',
        'title_zh': '《基于大语言模型的多智能体：进展与挑战综述》',
        'out': Path(r'C:\Users\lenovo\Desktop\Large language model based multi-agents a survey of progress and challenges\Large_Language_Model_Based_Multi-Agents_原文对照全文翻译.md'),
    },
    'LI': {
        'title_en': 'A survey on LLM-based multi-agent systems: workflow, infrastructure, and challenges',
        'title_zh': '《基于大语言模型的多智能体系统综述：工作流、基础设施与挑战》',
        'out': Path(r'C:\Users\lenovo\Desktop\A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges\LLM-Based_Multi-Agent_Systems_Survey_原文对照全文翻译.md'),
    },
}


def heading_depth(h):
    """Map a heading string to markdown heading level by its number depth."""
    m = re.match(r'^(\d+(?:\.\d+)*)\s', h)
    if h in ('Abstract', 'References', 'Declarations', 'Acknowledgements'):
        return 2
    if m:
        depth = len(m.group(1).split('.'))
        return min(depth + 1, 5)
    return 3


def main():
    for label in ('GUO', 'LI'):
        meta = TITLES[label]
        with open(ROOT / f'{label.lower()}_sections_v2.json', encoding='utf-8') as f:
            data = json.load(f)
        lines = []
        lines.append(f'# {meta["title_en"]}')
        lines.append('')
        lines.append(f'> 中文标题：{meta["title_zh"]}')
        lines.append('')
        lines.append('> 说明：本文件为“英文原文 + 逐段中文全文翻译”对照版。英文部分按原文逐段保留，中文部分逐段完整翻译，不总结、不省略。')
        lines.append('')
        lines.append('---')
        lines.append('')
        pid = 0
        for sec in data['sections']:
            h = sec['heading']
            if h == 'Declarations':
                paras = sec['paragraphs']
                split = next((i for i, p in enumerate(paras) if p.startswith('References')), None)
                decl = paras if split is None else paras[:split]
                refs = [] if split is None else paras[split:]
                lines.append('## Declarations')
                lines.append('')
                lines.append('> 中文：声明与数据可用性说明')
                lines.append('')
                for p in decl:
                    if p.strip():
                        lines.append('> 原文：')
                        lines.append('>')
                        lines.append(p)
                        lines.append('>')
                        lines.append(f'{{{{ZH:{label}:D:{pid}}}}}')
                        lines.append('')
                        pid += 1
                lines.append('## References')
                lines.append('')
                lines.append('> 中文：参考文献（按原文条目保留，不翻译）')
                lines.append('')
                for p in refs:
                    if p.strip():
                        lines.append('> 原文：')
                        lines.append('>')
                        lines.append(p)
                        lines.append('>')
                        lines.append(f'{{{{ZH:{label}:R:{pid}}}}}')
                        lines.append('')
                        pid += 1
                continue
            level = heading_depth(h)
            lines.append('#' * level + ' ' + h)
            lines.append('')
            lines.append(f'> 中文：{{{{ZHHEAD:{label}:{pid}}}}}')
            lines.append('')
            pid += 1
            for p in sec['paragraphs']:
                if not p.strip():
                    continue
                lines.append('> 原文：')
                lines.append('>')
                lines.append(p)
                lines.append('>')
                lines.append(f'{{{{ZH:{label}:B:{pid}}}}}')
                lines.append('')
                pid += 1
        text = '\n'.join(lines).rstrip() + '\n'
        meta['out'].write_text(text, encoding='utf-8')
        print(label, 'skeleton', meta['out'], 'bytes', len(text.encode('utf-8')), 'slots', pid)


if __name__ == '__main__':
    main()
