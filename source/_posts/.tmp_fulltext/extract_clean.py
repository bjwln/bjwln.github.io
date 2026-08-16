# -*- coding: utf-8 -*-
"""Extract clean two-column text from the two survey PDFs using PyMuPDF."""
import pymupdf
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

PDFS = {
    'GUO': r'C:\Users\lenovo\Zotero\storage\N2N2YYQL\Guo 等 - 2024 - Large language model based multi-agents a survey of progress and challenges.pdf',
    'LI': r'C:\Users\lenovo\Zotero\storage\BACGW35G\Li 等 - 2024 - A survey on LLM-based multi-agent systems workflow, infrastructure, and challenges.pdf',
}

# Fragments that usually belong to hyphenated compounds (keep the hyphen).
HYPHEN_PREFIXES = {
    'multi', 'single', 'real', 'human', 'self', 'decision', 'problem', 'open',
    'state', 'cross', 'well', 'inter', 'co', 'pre', 'pro', 'non', 'micro',
    'macro', 'socio', 'psycho', 'neuro', 'counter', 'cyber', 'bio', 'eco',
    'game', 'role', 'world', 'long', 'short', 'task', 'domain', 'object',
    'zero', 'few', 'high', 'low', 'large', 'small', 'end', 'hand', 'life',
    'time', 'real', 'llm', 'agent', 'agents', 'step', 'base', 'knowledge',
    'data', 'code', 'text', 'graph', 'model', 'LLM',
}

# Joined without hyphen is a normal English word -> remove the soft hyphen.
NO_HYPHEN_WORDS = {
    'cooperative', 'cooperation', 'interaction', 'interactive', 'interface',
    'interfaces', 'internal', 'international', 'coordinate', 'coordinated',
    'coordination', 'collaboration', 'collaborative', 'contextualized',
    'specialized', 'specialization', 'capabilities', 'communication',
    'community', 'communal', 'predefined', 'preference', 'preferences',
    'proactive', 'proposal', 'proposed', 'nonverbal', 'nonplayer',
    'interdisciplinary', 'interrelated', 'interconnected', 'interoperable',
    'interoperability', 'colocated', 'colocation', 'multimodal', 'multitask',
    'multilingual', 'multiturn', 'multiagent', 'multirobot', 'multidomain',
    'realtime', 'realworld', 'selfsupervised', 'selfreflection', 'selfevolution',
    'decisionmaking', 'problemsolving', 'stateoftheart', 'endtoend',
}


def norm(s):
    s = s.replace('\x07', ' ').replace('\u200a', ' ').replace('\u2002', ' ').replace('\u2003', ' ')
    s = s.replace('\xa0', ' ')
    s = s.replace('\u2011', '-').replace('\u2010', '-').replace('\u2012', '-')
    s = re.sub(r'[ \t]+', ' ', s)
    return s.strip()


def noise_block(text, label, pno):
    t = norm(text)
    if not t:
        return True
    if label == 'LI':
        if re.match(r'^Page \d+ of \d+', t):
            return True
        if re.match(r'^Li\s*et\s*al\.\s*Vicinagearth', t):
            return True
        if re.match(r'^Vicinagearth\s*$', t):
            return True
        if t.startswith('© The Author(s)'):
            return True
        if t.startswith('Publisher’s Note') or t.startswith("Publisher's Note"):
            return True
        if t == 'Declarations':
            return True
        if pno == 1 and ('School of Computer Science, Wuhan University' in t or 'ReLER, CCAI, Zhejiang University' in t):
            return True
        if t.startswith('*Correspondence:'):
            return True
    else:
        if re.match(r'^arXiv:\d{4}\.\d{4,5}', t):
            return True
        if t.startswith('∗This work was done when'):
            return True
        if t == '†Corresponding author.':
            return True
        if t.startswith('1https://github.com/taichengguo'):
            return True
    return False


def line_text(line):
    parts = []
    for span in line['spans']:
        parts.append(span['text'])
    return ''.join(parts)


def page_blocks(label, page, pno):
    d = page.get_text('dict')
    blocks = []
    for block in d['blocks']:
        if block['type'] != 0:
            continue
        x0, y0, x1, y1 = block['bbox']
        lines = []
        for line in block.get('lines', []):
            txt = norm(line_text(line))
            if not txt:
                continue
            size = max(span['size'] for span in line['spans'])
            lines.append({'text': txt, 'size': size, 'bbox': line['bbox']})
        if not lines:
            continue
        joined = '\n'.join(ln['text'] for ln in lines)
        if noise_block(joined, label, pno):
            continue
        if x1 < 40:
            continue
        blocks.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'lines': lines, 'pno': pno})
    return blocks


def order_blocks(blocks, page_width):
    mid = page_width / 2
    full = [b for b in blocks if b['x0'] < mid - 15 and b['x1'] > mid + 15]
    left = [b for b in blocks if b['x1'] <= mid + 15]
    right = [b for b in blocks if b['x0'] >= mid - 15]
    left.sort(key=lambda b: b['y0'])
    right.sort(key=lambda b: b['y0'])
    full.sort(key=lambda b: b['y0'])
    lmin = min((b['y0'] for b in left), default=None)
    rmin = min((b['y0'] for b in right), default=None)
    lmax = max((b['y1'] for b in left), default=None)
    rmax = max((b['y1'] for b in right), default=None)
    body_min = min(x for x in (lmin, rmin) if x is not None) if (lmin is not None or rmin is not None) else None
    body_max = max(x for x in (lmax, rmax) if x is not None) if (lmax is not None or rmax is not None) else None
    top, middle, bottom = [], [], []
    for b in full:
        if body_min is not None and b['y1'] < body_min + 2:
            top.append(b)
        elif body_max is not None and b['y0'] > body_max - 2:
            bottom.append(b)
        else:
            middle.append(b)
    return top + left + middle + right + bottom


PARA = object()


def block_items(block):
    """Return a list of line dicts with PARA markers between paragraphs."""
    lines = block['lines']
    items = []
    heights = [ln['bbox'][3] - ln['bbox'][1] for ln in lines]
    med_h = sorted(heights)[len(heights) // 2] if heights else 10.0
    for i, ln in enumerate(lines):
        if i > 0:
            gap = ln['bbox'][1] - lines[i - 1]['bbox'][3]
            if gap > 0.42 * med_h + 0.5:
                items.append(PARA)
        items.append(ln)
    return items


def join_hyphen(a, b):
    """Decide whether a line ending in '-' and next line form one word."""
    m = re.search(r'([A-Za-z0-9]+)-\s*$', a['text'])
    n = re.match(r'^([A-Za-z0-9][A-Za-z0-9\']*)', b['text'])
    if not m or not n:
        return None
    f1, f2 = m.group(1), n.group(1)
    joined = f1 + f2
    if joined.lower() in NO_HYPHEN_WORDS or f2.lower() in NO_HYPHEN_WORDS:
        return (f1 + f2).lower() if joined.lower() in NO_HYPHEN_WORDS else (f1 + f2)
    if f1 in HYPHEN_PREFIXES or f1.lower() in HYPHEN_PREFIXES or f2.isupper():
        return f1 + '-' + f2
    return f1 + f2


def extract(label, path):
    doc = pymupdf.open(path)
    all_items = []
    for pno, page in enumerate(doc, 1):
        blocks = page_blocks(label, page, pno)
        ordered = order_blocks(blocks, page.rect.width)
        for b in ordered:
            for item in block_items(b):
                all_items.append(item)
    doc.close()
    return all_items


def is_guo_heading_line(item):
    if item['size'] < 10.8:
        return None
    t = item['text']
    if t == 'Abstract':
        return 'Abstract'
    m = re.match(r'^(\d+(?:\.\d+)*)$', t)
    if m:
        return ('NUM', m.group(1))
    return None


def is_li_heading_line(item):
    if item['size'] not in (9.2, 10.3):
        return None
    t = item['text']
    if t in ('Abstract', 'References', 'Acknowledgements'):
        return t
    m = re.match(r'^(\d+(?:\.\d+)*)\s+(.+)$', t)
    if m:
        return m.group(1) + ' ' + m.group(2).strip()
    return None


def build_sections(label, items):
    """Convert the line stream into sections with paragraphs."""
    head_fn = is_guo_heading_line if label == 'GUO' else is_li_heading_line
    # Normalize items: merge hyphenation, strip paragraph markers.
    merged = []
    i = 0
    while i < len(items):
        item = items[i]
        if item is PARA:
            merged.append(PARA)
            i += 1
            continue
        nxt = None
        j = i + 1
        while j < len(items) and items[j] is PARA:
            j += 1
        if j < len(items) and items[j] is not PARA:
            nxt = items[j]
        if nxt is not None:
            r = join_hyphen(item, nxt)
            if r:
                item = {'text': re.sub(r'[A-Za-z0-9]+-\s*$', r, item['text']), 'size': item['size'], 'bbox': item['bbox']}
                merged.append(item)
                i = j + 1
                continue
        merged.append(item)
        i += 1

    # Second pass: detect headings.
    sections = []
    current = None
    pending_num = None
    front = []
    n = len(merged)
    idx = 0
    while idx < n:
        item = merged[idx]
        if item is PARA:
            idx += 1
            continue
        head = head_fn(item)
        if label == 'GUO' and head and head[0] == 'NUM':
            # number-only heading; the title is the next text item
            j = idx + 1
            while j < n and merged[j] is PARA:
                j += 1
            if j < n and merged[j] is not PARA and merged[j]['size'] >= 10.8:
                title = merged[j]['text']
                head = head[1] + ' ' + title
                idx = j + 1
            else:
                head = head[1]
                idx += 1
        if head:
            current = {'heading': head, 'paragraphs': []}
            sections.append(current)
        elif current is None:
            front.append(item['text'])
        else:
            current['paragraphs'].append(item['text'])
        idx += 1
    return sections, front


if __name__ == '__main__':
    for label, path in PDFS.items():
        items = extract(label, path)
        sections, front = build_sections(label, items)
        out_path = r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\%s_sections.json' % label.lower()
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump({'label': label, 'front': front, 'sections': sections}, f, ensure_ascii=False, indent=1)
        print(label, 'items:', len(items), 'sections:', len(sections))
        for s in sections:
            chars = sum(len(p) for p in s['paragraphs'])
            print(' ', s['heading'], '| paras:', len(s['paragraphs']), '| chars:', chars)
