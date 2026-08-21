# -*- coding: utf-8 -*-
import re
from pdfplumber import open as pdf_open

src = r"C:\Users\lenovo\Zotero\storage\T7V6IZ2B\Xiong 等 - 2026 - Not just one agent LLM-based multi-agent systems for medicine from answer generation to accountable.pdf"
out_txt = r"G:\hexo\my-blog\source\_posts\.tmp_fulltext\xiong2026.txt"


def norm_line(line):
    return re.sub(r'\s+', ' ', line).strip()


def chars_to_lines(chars):
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


with pdf_open(src) as pdf:
    with open(out_txt, 'w', encoding='utf-8') as f:
        for pno, page in enumerate(pdf.pages, 1):
            chars = page.chars
            if not chars:
                f.write('\n===== PAGE %d =====\n' % pno)
                continue
            top_header = min(c['top'] for c in chars)
            body_chars = [c for c in chars if c['top'] > top_header + 42]
            if len(body_chars) < 20:
                body_chars = chars
            xs = sorted(set(round(c['x0'] / 5) * 5 for c in body_chars))
            if len(xs) >= 2:
                gaps = [(b - a, a, b) for a, b in zip(xs, xs[1:])]
                best_gap, gap_a, gap_b = max(gaps, key=lambda g: g[0])
                if best_gap >= 25:
                    mid = (gap_a + gap_b) / 2
                    left = [c for c in chars if c['x0'] < mid and c['top'] > top_header + 30]
                    right = [c for c in chars if c['x0'] >= mid and c['top'] > top_header + 30]
                    f.write('\n===== PAGE %d COL 1 =====\n' % pno)
                    f.write('\n'.join(t for _, t in chars_to_lines(left) if t))
                    f.write('\n===== PAGE %d COL 2 =====\n' % pno)
                    f.write('\n'.join(t for _, t in chars_to_lines(right) if t))
                    continue
            f.write('\n===== PAGE %d =====\n' % pno)
            f.write('\n'.join(t for _, t in chars_to_lines(chars) if t))

print('done')
