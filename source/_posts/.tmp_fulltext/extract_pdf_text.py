# -*- coding: utf-8 -*-
import re, io
from pdfplumber import open as pdf_open

paths = {
    'LI': r'C:\Users\lenovo\Zotero\storage\BACGW35G\Li 等 - 2024 - A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges.pdf',
    'GUO': r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\Guo 等 - 2024 - Large language model based multi-agents a survey of progress and challenges.pdf',
}


def norm_line(line):
    line = re.sub(r'\s+', ' ', line).strip()
    return line


def chars_to_lines(chars):
    """Group characters by y-band and join into words using x-gaps."""
    rows = {}
    for c in chars:
        key = round(c['top'] / 4) * 4
        rows.setdefault(key, []).append(c)
    lines = []
    for key in sorted(rows):
        cs = sorted(rows[key], key=lambda c: c['x0'])
        parts = []
        prev_x1 = None
        for c in cs:
            ch = c['text']
            if not parts:
                parts.append(ch)
            else:
                gap = c['x0'] - prev_x1
                parts.append((' ' if gap > 0.5 else '') + ch)
            prev_x1 = c['x1']
        text = ''.join(parts)
        lines.append((key, norm_line(text)))
    return lines


def extract_pdf(path):
    chunks = []
    with pdf_open(path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            chars = page.chars
            if not chars:
                chunks.append(('PAGE %d' % pno, ''))
                continue
            top_header = min(c['top'] for c in chars)
            # 排除页眉区（期刊页眉/论文标题区），只保留正文区用于分栏检测
            body_chars = [c for c in chars if c['top'] > top_header + 42]
            if len(body_chars) < 20:
                body_chars = chars
            xs = sorted(set(round(c['x0'] / 5) * 5 for c in body_chars))
            if len(xs) >= 2:
                # 尝试在 x 分布中间找最大的空隙，作为两栏分界
                gaps = [(b - a, a, b) for a, b in zip(xs, xs[1:])]
                best_gap, gap_a, gap_b = max(gaps, key=lambda g: g[0])
                if best_gap >= 25:
                    mid = (gap_a + gap_b) / 2
                    left_chars = [c for c in chars if c['x0'] < mid and c['top'] > top_header + 30]
                    right_chars = [c for c in chars if c['x0'] >= mid and c['top'] > top_header + 30]
                    llines = chars_to_lines(left_chars)
                    rlines = chars_to_lines(right_chars)
                    ltext = '\n'.join(t for _, t in llines if t)
                    rtext = '\n'.join(t for _, t in rlines if t)
                    chunks.append(('PAGE %d COL 1' % pno, ltext))
                    chunks.append(('PAGE %d COL 2' % pno, rtext))
                    continue
                lines = chars_to_lines(chars)
                text = '\n'.join(t for _, t in lines if t)
                chunks.append(('PAGE %d' % pno, text))
            else:
                lines = chars_to_lines(chars)
                text = '\n'.join(t for _, t in lines if t)
                chunks.append(('PAGE %d' % pno, text))
    return chunks


if __name__ == '__main__':
    for label, path in paths.items():
        chunks = extract_pdf(path)
        with open(r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\%s_columns.txt' % label.lower(), 'w', encoding='utf-8') as f:
            for tag, text in chunks:
                f.write('===== %s =====\n%s\n' % (tag, text))
        print(label, len(chunks), 'chunks')
