# -*- coding: utf-8 -*-
"""Extract two-column survey PDFs into sections with faithful paragraphs."""
import json
import re
import sys
from pathlib import Path

import pymupdf

sys.stdout.reconfigure(encoding='utf-8')


def find_pdf(folder, pattern):
    hits = list(Path(folder).glob(pattern))
    return str(hits[0]) if hits else None


PDFS = {
    'GUO': find_pdf(r'C:\Users\lenovo\Zotero\storage\N2N2YYQL', '*Guo*.pdf'),
    'LI': find_pdf(r'C:\Users\lenovo\Zotero\storage\BACGW35G', '*Li*.pdf'),
}

# Explicit table regions (page number -> list of [y0, y1]).  Table cells are
# excluded from the prose stream and emitted separately as table artifacts.
TABLE_REGIONS = {
    'GUO': {
        6: [[50.0, 525.0]],
        9: [[50.0, 320.0]],
    },
    'LI': {
        5: [[80.0, 720.0]],
        6: [[80.0, 260.0]],
        27: [[310.0, 510.0]],
    },
}

HYPHEN_PREFIXES = {
    'multi', 'single', 'real', 'human', 'self', 'decision', 'problem', 'open',
    'state', 'cross', 'well', 'inter', 'co', 'pre', 'pro', 'non', 'micro',
    'macro', 'socio', 'psycho', 'neuro', 'counter', 'cyber', 'bio', 'eco',
    'game', 'role', 'world', 'long', 'short', 'task', 'domain', 'object',
    'zero', 'few', 'high', 'low', 'large', 'small', 'end', 'hand', 'life',
    'time', 'llm', 'agent', 'agents', 'step', 'base', 'knowledge', 'data',
    'code', 'text', 'graph', 'model', 'LLM', 'LLM-', 'agent-', 'self-',
    'communication', 'interaction', 'coordination', 'collaboration',
    'problem', 'decision', 'distributed', 'reinforcement', 'representation',
    'information', 'in-context', 'agentic',
}

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
    'tooluse', 'toolusing', 'finetuned', 'pretrained', 'preprocessing',
    'postprocessing', 'subgoals', 'subtasks', 'counterfactual', 'codex',
    'dataset', 'datasets', 'benchmark', 'benchmarks', 'workflow', 'workflows',
    'framework', 'frameworks', 'interoperation', 'interagent', 'intraagent',
}


def norm(s):
    s = s.replace('\x07', ' ').replace('\u200a', ' ').replace('\u2002', ' ')
    s = s.replace('\u2003', ' ').replace('\xa0', ' ')
    s = s.replace('\u2011', '-').replace('\u2010', '-').replace('\u2012', '-')
    s = re.sub(r'[ \t]+', ' ', s)
    return s.strip()


def noise_text(text, label, pno):
    t = norm(text)
    if not t:
        return True
    if label == 'LI':
        if re.match(r'^Page \d+ of \d+$', t):
            return True
        if re.match(r'^Li\s*et\s*al\.\s*Vicinagearth', t):
            return True
        if t == 'Vicinagearth':
            return True
        if t.startswith('漏 The Author(s)'):
            return True
        if t.startswith('Publisher鈥檚 Note') or t.startswith("Publisher's Note"):
            return True
        if pno == 1 and (
            'School of Computer Science, Wuhan University' in t
            or 'ReLER, CCAI, Zhejiang University' in t
            or 'Corresponding author' in t
        ):
            return True
        if t.startswith('*Correspondence:'):
            return True
    else:
        if re.match(r'^arXiv:\d{4}\.\d{4,5}', t):
            return True
        if t.startswith('1https://github.com/taichengguo'):
            return True
        if t == '1https://github.com/taichengguo/LLM MultiAgents Survey Papers':
            return True
        if re.match(r'^\d{4}\.\d{4,5}v\d+\s*$', t):
            return True
    return False


def line_parts(line):
    spans = [s for s in line['spans'] if s['text']]
    if not spans:
        return None
    text = norm(''.join(s['text'] for s in spans))
    if not text:
        return None
    size = max(s['size'] for s in spans)
    bold = any((s['flags'] & 16) or 'Medi' in s['font'] or 'Bold' in s['font']
               for s in spans)
    x0, y0, x1, y1 = line['bbox']
    return {
        'text': text,
        'size': size,
        'bold': bold,
        'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
    }


def collect_units(label, page, pno):
    d = page.get_text('dict')
    page_w = page.rect.width
    page_h = page.rect.height
    units = []
    regions = TABLE_REGIONS.get(label, {}).get(pno, [])
    for block in d['blocks']:
        if block['type'] != 0:
            continue
        if regions:
            bx0, by0, bx1, by1 = block['bbox']
            by = (by0 + by1) / 2.0
            if any(r0 <= by <= r1 for r0, r1 in regions):
                continue
        lines = []
        for line in block.get('lines', []):
            info = line_parts(line)
            if info is None:
                continue
            if noise_text(info['text'], label, pno):
                continue
            lines.append(info)
        if not lines:
            continue
        bbox = block['bbox']
        if bbox[2] < 40:
            continue
        units.append({'lines': lines, 'bbox': bbox, 'pno': pno})
    return units, page_w, page_h


def merge_same_baseline(lines):
    """Merge spans that PyMuPDF split onto the same visual baseline."""
    out = []
    for line in sorted(lines, key=lambda l: (l['y0'], l['x0'])):
        if out and abs(line['y0'] - out[-1]['y0']) < 2.0:
            prev = out[-1]
            prev['text'] = prev['text'] + ' ' + line['text']
            prev['x1'] = max(prev['x1'], line['x1'])
            prev['y1'] = max(prev['y1'], line['y1'])
            prev['size'] = max(prev['size'], line['size'])
        else:
            out.append(dict(line))
    for l in out:
        l['text'] = re.sub(r'\s+', ' ', l['text']).strip()
    return out


def order_units(units, page_w, page_h):
    mid = page_w / 2
    full, left, right = [], [], []
    for u in units:
        x0, y0, x1, y1 = u['bbox']
        if x0 < mid - 15 and x1 > mid + 15:
            full.append(u)
        elif x1 <= mid + 15:
            left.append(u)
        else:
            right.append(u)
    full.sort(key=lambda u: u['bbox'][1])
    left.sort(key=lambda u: u['bbox'][1])
    right.sort(key=lambda u: u['bbox'][1])
    merged = []
    li = 0
    for fu in full:
        fy = fu['bbox'][1]
        while li < len(left) and left[li]['bbox'][1] < fy:
            merged.append(left[li])
            li += 1
        merged.append(fu)
    merged.extend(left[li:])
    merged.extend(right)
    return merged


def is_heading_line(info, label):
    t = info['text']
    size = info['size']
    if label == 'LI':
        if not is_heading_size(info, label):
            return None
        if t in ('Abstract', 'References', 'Acknowledgements', 'Declarations'):
            return t
        m = re.match(r'^(\d+(?:\.\d+)*)\s+(\S.*)$', t)
        if m and m.group(2)[0].isupper():
            return m.group(1) + ' ' + m.group(2).strip()
        return None
    else:
        if not is_heading_size(info, label):
            return None
        if t in ('Abstract', 'References', 'Acknowledgements', 'Acknowledgment'):
            return t
        m = re.match(r'^(\d+(?:\.\d+)*)\s+(\S.*)$', t)
        if m and m.group(2)[0].isupper():
            return m.group(1) + ' ' + m.group(2).strip()
        return None


def is_heading_size(info, label):
    size = info['size']
    if label == 'LI':
        return any(abs(size - v) < 0.05 for v in (9.2, 10.3))
    return size >= 10.5 or info['bold']


def join_para_lines(lines):
    """Join visual lines into a paragraph, fixing hyphenated line breaks."""
    parts = []
    for i, ln in enumerate(lines):
        text = ln['text']
        if parts and re.search(r'[A-Za-z0-9]+-\s*$', parts[-1]) and text:
            m = re.search(r'([A-Za-z0-9]+)-\s*$', parts[-1])
            n = re.match(r'^([A-Za-z0-9][A-Za-z0-9\'’]*)', text)
            if m and n:
                f1, f2 = m.group(1), n.group(1)
                joined = f1 + f2
                if joined.lower() in NO_HYPHEN_WORDS:
                    repl = joined
                elif f1 in HYPHEN_PREFIXES or f1.lower() in HYPHEN_PREFIXES or f2.isupper():
                    repl = f1 + '-' + f2
                else:
                    repl = joined
                parts[-1] = re.sub(r'[A-Za-z0-9]+-\s*$', repl, parts[-1])
                text = text[len(n.group(0)):]
                if text:
                    parts.append(text)
                continue
        parts.append(text)
    return re.sub(r'\s+', ' ', ' '.join(parts)).strip()


def build_sections(label, units_by_page):
    sections = []
    current = None
    front = []
    pending_para = None
    last_para = None

    def flush_para():
        nonlocal pending_para, last_para
        if pending_para is not None:
            text = pending_para.strip()
            if text:
                if current is None:
                    front.append(text)
                else:
                    current['paragraphs'].append(text)
                last_para = text
            pending_para = None

    for pno, units in units_by_page.items():
        for unit in units:
            lines = merge_same_baseline(unit['lines'])
            lines.sort(key=lambda l: (l['y0'], l['x0']))
            # Split the visual block into (heading, body) segments so that
            # multiple headings inside one block (e.g. "2 Background" followed
            # by "2.1 ...") become separate sections instead of being merged.
            segments = []
            seg_heading = None
            seg_lines = []
            for ln in lines:
                h = is_heading_line(ln, label)
                if h is not None:
                    if seg_heading is not None or seg_lines:
                        segments.append((seg_heading, seg_lines))
                    seg_heading = h
                    seg_lines = []
                else:
                    seg_lines.append(ln)
            if seg_heading is not None or seg_lines:
                segments.append((seg_heading, seg_lines))

            for heading, seg_lines in segments:
                if heading:
                    flush_para()
                    current = {'heading': re.sub(r'\s+', ' ', heading).strip(), 'paragraphs': []}
                    sections.append(current)
                body = seg_lines
                if not body:
                    continue
                text = join_para_lines(body)
                if text:
                    if current is None:
                        front.append(text)
                        last_para = text
                    else:
                        # Merge a paragraph that continues across a page boundary.
                        first = body[0]['text']
                        if (pending_para is None and current['paragraphs']
                                and last_para and last_para[-1] not in '.!?:'
                                and first and first[0].islower()):
                            current['paragraphs'][-1] += ' ' + text
                            last_para = current['paragraphs'][-1]
                        else:
                            current['paragraphs'].append(text)
                            last_para = text
    flush_para()
    return sections, front


def dump_label(label):
    doc = pymupdf.open(PDFS[label])
    units_by_page = {}
    for pno, page in enumerate(doc, 1):
        units, page_w, page_h = collect_units(label, page, pno)
        units_by_page[pno] = order_units(units, page_w, page_h)
    doc.close()
    sections, front = build_sections(label, units_by_page)
    out_path = Path(__file__).parent / f'{label.lower()}_sections_v2.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'label': label, 'front': front, 'sections': sections}, f,
                  ensure_ascii=False, indent=1)
    total_chars = sum(len(p) for s in sections for p in s['paragraphs'])
    print(label, 'sections:', len(sections), 'paras:', sum(len(s['paragraphs']) for s in sections),
          'front paras:', len(front), 'chars:', total_chars)
    for s in sections:
        chars = sum(len(p) for p in s['paragraphs'])
        print(' ', s['heading'], '| paras:', len(s['paragraphs']), '| chars:', chars)


if __name__ == '__main__':
    for label in ('GUO', 'LI'):
        dump_label(label)
