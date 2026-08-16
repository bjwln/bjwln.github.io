# -*- coding: utf-8 -*-
import re, io

LI_TRANSLATION = r'C:\Users\lenovo\Desktop\LLM-Based_Multi-Agent_Systems_Survey_论文全文翻译.md'
GUO_TRANSLATION = r'C:\Users\lenovo\Desktop\Large_Language_Model_Based_Multi-Agents_论文全文翻译.md'
LI_TXT = r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\li2024.txt'
GUO_TXT = r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\guo2024.txt'
GUO_TABLES = r'G:\hexo\my-blog\source\_posts\.tmp_fulltext\tables_full.txt'


def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def clean_cell(s):
    s = re.sub(r'\s*\|\s*', ', ', s)
    s = re.sub(r'\s+', ' ', s).strip(' ,')
    return s


def md_table(headers, rows):
    out = ['| ' + ' | '.join(headers) + ' |',
           '| ' + ' | '.join(['---'] * len(headers)) + ' |']
    for row in rows:
        cells = []
        for i, cell in enumerate(row):
            text = str(cell).replace('|', '/')
            text = re.sub(r'\s+', ' ', text).strip()
            cells.append(text)
        while len(cells) < len(headers):
            cells.append('')
        out.append('| ' + ' | '.join(cells[:len(headers)]) + ' |')
    return '\n'.join(out)


# ---------- Li 2024: abbreviations ----------
li = read(LI_TXT)
abbr_start = li.index('Abbreviations in this paper')
abbr_block = li[abbr_start:abbr_start + 12000]
abbr_block = abbr_block.split('===== PAGE 34 =====')[0]
abbr_lines = []
for line in abbr_block.splitlines():
    line = line.strip()
    if not line:
        continue
    m = re.match(r'^([A-Z][A-Z0-9\-/]*)\s+(.+)$', line)
    if m:
        abbr_lines.append((m.group(1), m.group(2)))
# 手工修正/补齐已知缩写（原文按两栏排印，提取时首尾容易错位）
known = {
    'LLMs': 'Large language models（大语言模型）',
    'MAS': 'Multi-agent systems（多智能体系统）',
    'RL': 'Reinforcement learning（强化学习）',
    'MLLMs': 'Multi-modal large language models（多模态大语言模型）',
    'CoT': 'Chain-of-thought（思维链）',
    'VLMs': 'Visual language models（视觉语言模型）',
    'ViT': 'Vision Transformer（视觉 Transformer）',
    'VQVAE': 'Vector Quantized Variational AutoEncoder（向量量化变分自编码器）',
    'Q-Former': 'Querying Transformer（查询 Transformer）',
    'AST': 'Abstract Syntax Tree（抽象语法树）',
    'FIFO': 'First In, First Out（先进先出）',
    'CNNs': 'Convolutional Neural Networks（卷积神经网络）',
    'RNNs': 'Recurrent Neural Networks（循环神经网络）',
    'RAG': 'Retrieval-Augmented Generation（检索增强生成）',
    'ToT': 'Tree of Thoughts（思维树）',
    'PDDL': 'Planning Domain Definition Language（规划领域定义语言）',
    'ICL': 'In-Context Learning（上下文学习）',
    'LoRA': 'Low-Rank Adaptation（低秩适配）',
    'DMAS': 'Decentralized Multi-Agent System（去中心化多智能体系统）',
    'SOPs': 'Standard Operating Procedures（标准化操作流程）',
    'EDA': 'Electronic Design Automation（电子设计自动化）',
    'RTL': 'Register Transfer Level（寄存器传输级）',
    'GDSII': 'Graphic Database System II（版图数据格式）',
    'FDTD': 'Finite-Difference Time-Domain（时域有限差分）',
    'PCSEL': 'Photonic Crystal Surface-Emitting Laser（光子晶体表面发射激光器）',
    'MAD': 'Multi-Agent Debate（多智能体辩论）',
    'DoT': 'Domain of Thought（思维领域）',
}
abbr_rows = []
for abbr, exp in abbr_lines:
    if abbr in known:
        abbr_rows.append((abbr, known[abbr]))
    else:
        abbr_rows.append((abbr, exp))
# 去重并按缩写字母排序
seen = set()
unique = []
for row in abbr_rows:
    if row[0] not in seen:
        seen.add(row[0])
        unique.append(row)
unique.sort(key=lambda x: x[0].lower())
li_abbr_md = ('## 附录：缩写表\n\n'
              + md_table(['缩写', '全称（中文）'], unique)
              + '\n')


# ---------- Li 2024: Table 1 ----------
li_t1_start = li.index('Table 1 A review of representative works')
li_t1_block = li[li_t1_start:li_t1_start + 16000]
li_t1_body = li_t1_block.split('===== PAGE 6 =====')[0]
li_t1_note = li.index('We present current representative works', li_t1_start)
li_t1_body = li_t1_block[:li_t1_note - li_t1_start]

li_t1_rows = []
for line in li_t1_body.splitlines():
    line = line.strip()
    if not line:
        continue
    if line.lower().startswith(('table 1', 'work object modality', 'generative agent sociology')):
        continue
    if line.startswith(('[', 'Generative Agent [28]', 'Planner-Actor-', 'ChatDev [30]',
                        'MetaGPT [31]', 'Dong et al. [32]', 'Chen et al. [33]',
                        'Roco [34]', 'Zhang et al. [35]', 'Du et al. [36]',
                        'Xiong et al. [37]', 'ChatEval [38]', 'Medagents [39]',
                        'Social Simulacra [40]', 'S3 [14]', 'Lyfe Agents [41]',
                        'Li et al. [42]', 'Xu et al. [43]', 'Avalonbench [44]',
                        'Welfare diplomacy', 'Aher et al. [46]', 'Zhang at.all [47]',
                        'Agent4Rec [48]', 'AgentCF [49]', 'EconAgent [50]',
                        'Weiss et al. (Weiss', 'Tradinggpt [51]', 'Williams et al. [52]',
                        'Boiko et al. [6]', 'GPT4IA [3]', 'ProAgent [53]', 'SAMA [54]')):
        li_t1_rows.append(line)

# 将提取的表格行重排为列；采用 PDF 原文列顺序：
# Work | Object | Modality | Base model | Train | Feedback | Evaluation | Interaction
li_t1_data = []
for raw in li_t1_rows:
    raw = raw.replace('Vision, Text', 'Vision, Text')
    li_t1_data.append(raw)


def parse_li_t1(lines):
    # 手工列映射，基于正文提取的原文表格内容
    entries = [
        ('Generative Agent [28]', '社会学（25 个智能体）', '文本', 'GPT-3.5-turbo', '否',
         '环境、智能体交互', '-', '-'),
        ('Planner-Actor-Reporter [29]', '具身环境', '视觉、文本', '-', '是',
         '环境', '胜率', '合作'),
        ('ChatDev [30]', '软件开发', '文本', '领域专用模型', '否',
         '环境、智能体交互、人类', '数据集上与模型对比', '合作'),
        ('MetaGPT [31]', '软件开发', '视觉、文本', '领域专用模型', '是',
         '环境、智能体交互、人类', '数据集上与模型对比', '合作'),
        ('Dong et al. [32]', '软件开发', '文本', 'GPT-3.5', '否',
         '环境、智能体交互', '基准上与模型对比', '合作'),
        ('Chen et al. [33]', '多机器人规划', '视觉、文本', 'GPT-4-0613、GPT-3.5-turbo-0613', '否',
         '环境、智能体交互', '与框架对比', '合作'),
        ('Roco [34]', '多机器人协作', '视觉、文本', 'GPT-4', '否',
         '环境、智能体交互', '数据集', '合作'),
        ('Zhang et al. [35]', '多智能体协作', '视觉、文本', 'GPT-4', '是',
         '环境、智能体交互', '与模型对比', '合作'),
        ('Du et al. [36]', '提升事实性', '文本', '基于 GPT 的模型', '否',
         '智能体交互', '数据集', '辩论'),
        ('Xiong et al. [37]', '考察相互一致性', '文本', '6 个 LLM', '否',
         '智能体交互', '数据集、与模型对比', '辩论'),
        ('ChatEval [38]', '辩论评估器', '文本', 'GPT-4、GPT-3.5-turbo', '否',
         '智能体交互', '数据集', '辩论'),
        ('Medagents [39]', '用药讨论', '文本', 'GPT-4、GPT-3.5-Turbo', '否',
         '智能体交互', '数据集', '辩论、合作'),
        ('Social Simulacra [40]', '社会学（1000 个智能体）', '文本', 'GPT-3', '否',
         '智能体交互、人类', '数据集', '-'),
        ('S3 [14]', '情绪传播', '文本', 'GPT-3.5、ChatGLM', '是',
         '智能体交互', '数据集', '-'),
        ('Lyfe Agents [41]', '实时社会交互', '视觉、文本', 'GPT-3.5', '否',
         '环境、智能体交互', '实验场景', '-'),
        ('Li et al. [42]', '观点动力学', '文本', '-', '否',
         '智能体交互', '基准', '-'),
        ('Xu et al. [43]', '狼人杀', '文本', 'GPT-3.5-turbo-0301', '否',
         '环境、智能体交互', '胜率', '混合'),
        ('Avalonbench [44]', 'Avalon 游戏', '文本', 'GPT-3.5、Llama2', '否',
         '环境、智能体交互', '胜率、与模型对比', '混合'),
        ('Welfare diplomacy [45]', '福利外交游戏', '文本', '-', '否',
         '环境、智能体交互', '与模型对比', '混合'),
        ('Aher et al. [46]', '人类行为模拟', '文本', 'GPT 系列模型', '否',
         '智能体交互、人类', '数据集', '-'),
        ('Zhang et al. [47]', '协作机制探索', '文本', 'GPT-3.5-turbo-1106', '否',
         '智能体交互', '数据集、与模型对比', '混合'),
        ('Agent4Rec [48]', '推荐系统（1000 个智能体）', '文本', 'GPT-3.5-turbo', '否',
         '环境', '数据集、人类', '-'),
        ('AgentCF [49]', '用户-物品交互模拟', '文本', '-', '否',
         '环境、智能体交互', '数据集、与模型对比', '合作'),
        ('EconAgent [50]', '宏观经济模拟', '文本', 'GPT-3.5-turbo-0613', '否',
         '智能体交互', '与模型对比', '合作'),
        ('Weiss et al.（审稿中）', '信息市场中的买方检验悖论', '文本', 'Llama 2', '否',
         '环境、智能体交互', '数据集、与模型对比', '混合'),
        ('TradingGPT [51]', '改进金融交易', '多模态', 'GPT-3.5-turbo', '是',
         '环境、智能体交互', '数据集、与模型对比', '对抗'),
        ('Williams et al. [52]', '流行病学研究', '文本', 'GPT-3.5-turbo-0301', '否',
         '环境、智能体交互', '-', '合作'),
        ('Boiko et al. [6]', '化学实验', '多模态', 'GPT-3.5、GPT-4', '否',
         '环境、智能体交互', '-', '混合'),
        ('GPT4IA [3]', '工业环境', '多模态', 'GPT 系列模型', '是',
         '环境、智能体交互', '-', '合作'),
        ('ProAgent [53]', '团队合作', '多模态', '-', '否',
         '环境、智能体交互、人类', '与模型对比', '混合'),
        ('SAMA [54]', '游戏', '文本', 'GPT-3.5、GPT-4', '否',
         '环境、智能体交互', '与模型对比', '合作'),
    ]
    return entries


li_t1_entries = parse_li_t1(li_t1_rows)
li_t1_md = ('## 附录：表 1 代表性工作总览（中译）\n\n'
            + md_table(['工作', '对象/场景', '模态', '基座模型', '是否训练', '反馈来源', '评估方式', '交互类型'],
                       li_t1_entries)
            + '\n\n> 表注：原文表 1 的完整注记为 “-” 表示该工作中未特别说明对应元素。\n')


# ---------- Li 2024: Table 2 ----------
li_t2_start = li.index('Table 2 Representative applications of the LLM-based multi-agent system')
li_t2_end = li.index('===== PAGE 29 =====', li_t2_start)
li_t2_block = li[li_t2_start:li_t2_end]
li_t2_entries = []
for line in li_t2_block.splitlines():
    line = line.strip()
    if not line or line.lower().startswith(('table 2', 'application domain work')):
        continue
    li_t2_entries.append(line)

li_t2_parsed = []
cur = None
for line in li_t2_entries:
    if re.match(r'^(Problem Solving|World Simulation)$', line):
        if cur:
            li_t2_parsed.append(cur)
        cur = [line, '', '']
        continue
    if cur is None:
        continue
    parts = re.split(r'\s{2,}', line)
    if len(parts) >= 2:
        if cur[1]:
            li_t2_parsed.append(cur)
            cur = [cur[0], parts[0], parts[1]]
        else:
            cur[1] = parts[0]
            cur[2] = parts[1]
    else:
        if parts[0]:
            cur[2] += ' ' + parts[0]
if cur:
    li_t2_parsed.append(cur)

# 手工重排表 2（原文两栏表格，提取行序会跨栏交错）
li_t2_rows = [
    ['问题求解', '软件开发', 'Dong et al. [32]、ChatEDA [303]、LIBRO [304]、PENTESTGPT [305]'],
    ['问题求解', '工业工程', 'Mehta et al. [2]、Xia et al. [3]、Li et al. [4]'],
    ['问题求解', '具身智能体', 'SayCan [8]、Inner Monologue [9]、TidyBot [10]、RoCo [34]、CoELA [35]'],
    ['问题求解', '科学实验', 'Ghafarollahi et al. [5]、Boiko et al. [6]、ChemCrow [7]'],
    ['问题求解', '科学辩论', 'Du et al. [36]、Liang et al. [264]、ChatEval [38]'],
    ['世界模拟', '游戏', 'Li et al. [12]、Renella et al. [13]、MarioGPT [306]'],
    ['世界模拟', '社会模拟', 'Gao et al. [14]、Ma et al. [15]、CGMI [16]'],
    ['世界模拟', '经济/金融交易', 'Horton et al. [307]、Akata et al. [308]、Guo et al. [256]、CompeteAI [257]'],
    ['世界模拟', '推荐系统', 'Zhang et al. [309]、TALLRec [310]、Hou et al. [311]、Liu et al. [312]、Chat-Rec [313]、Dai et al. [314]、KAR [315]、GENRE [316]、LLMRec [317]、RecAgent [60]、RecSim [318]、Agent4Rec [59]、AgentCF [49]'],
    ['世界模拟', '疾病传播模拟', 'Williams et al. [52]、Ghaffarzadegan et al. [319]'],
]
li_t2_md = ('## 附录：表 2 LLM-based 多智能体系统代表性应用（中译）\n\n'
            + md_table(['应用主线', '应用领域', '代表性工作'], li_t2_rows)
            + '\n')


# ---------- Li 2024: references ----------
li_ref_start = li.index('References', li.index('===== PAGE 34 ====='))
li_refs = li[li_ref_start + len('References'):]
li_refs = li_refs.split('Publisher')[0]
li_refs = re.sub(r'===== PAGE \d+ =====\s*', '', li_refs)
li_refs = re.sub(r'Li et al\. Vicinagearth \(2024\) 1:9 Page \d+ of 43\s*', '', li_refs)
li_ref_parts = re.split(r'(?m)^\s*(\d+)\.\s+', li_refs)
li_ref_items = []
if li_ref_parts and li_ref_parts[0].strip():
    # 头部残渣
    pass
for i in range(1, len(li_ref_parts), 2):
    num = li_ref_parts[i]
    body = re.sub(r'\s+', ' ', li_ref_parts[i + 1]).strip()
    if body:
        li_ref_items.append((int(num), body))
li_ref_items.sort(key=lambda x: x[0])
li_ref_md = '## 附录：参考文献（原文条目，未翻译）\n\n'
for num, body in li_ref_items:
    li_ref_md += f'{num}. {body}\n'


# ---------- Guo 2024: tables ----------
guo = read(GUO_TXT)
guo_tables_raw = read(GUO_TABLES)
guo_t1_start = guo_tables_raw.index('page 6 table 0')
guo_t1_end = guo_tables_raw.index('page 9 table 0')
guo_t1_block = guo_tables_raw[guo_t1_start:guo_t1_end]

guo_t1_rows = []
for line in guo_t1_block.splitlines():
    line = line.strip()
    if not line.startswith('ROW'):
        continue
    cells = [clean_cell(c) for c in line.split('\t')[1:]]
    guo_t1_rows.append(cells)

# 领域/目标两列从提取的合并单元格展开为平铺行
guo_domains = {
    'Software development': ('问题求解', '软件开发'),
    'Embodied Agents': ('问题求解', '具身智能体'),
    'Science Experiments': ('问题求解', '科学实验'),
    'Science Debate': ('问题求解', '科学辩论'),
    'Society': ('世界模拟', '社会模拟'),
    'Gaming': ('世界模拟', '游戏'),
    'Psychology': ('世界模拟', '心理学'),
    'Economy': ('世界模拟', '经济学'),
    'Recommender Systems': ('世界模拟', '推荐系统'),
    'Policy Making': ('世界模拟', '政策制定'),
    'Disease': ('世界模拟', '疾病传播模拟'),
}
guo_t1_final = []
current_main = ''
current_sub = ''
for cells in guo_t1_rows[1:]:
    if not cells or all(not c for c in cells):
        continue
    col0 = cells[0]
    if col0 in guo_domains:
        current_main, current_sub = guo_domains[col0]
    if len(cells) < 11:
        cells = cells + [''] * (11 - len(cells))
    work = cells[2]
    if not work:
        continue
    env = cells[3]
    prof_m = cells[4]
    prof_e = cells[5]
    para = cells[6]
    struct = cells[7]
    fb = cells[8]
    adjust = cells[9] if len(cells) > 9 else ''
    guo_t1_final.append([current_main, current_sub, work, env, prof_m, prof_e, para, struct, fb, adjust])

guo_t1_md = ('## 附录：表 1 代表性工作比较（中译）\n\n'
             + md_table(['主线', '领域/目标', '工作', '环境接口', '画像方法', '画像示例',
                         '通信范式', '通信结构', '反馈来源', '能力获取/调整'],
                        guo_t1_final)
             + '\n')

# Guo 表 2
guo_t2_block = guo_tables_raw[guo_t1_end:]
guo_t2_rows = []
for line in guo_t2_block.splitlines():
    line = line.strip()
    if not line.startswith('ROW'):
        continue
    cells = [clean_cell(c) for c in line.split('\t')[1:]]
    guo_t2_rows.append(cells)

domain_map2 = {
    'SoftwareDevelopment': '软件开发',
    'EmbodiedAI': '具身智能',
    'ScienceDebate': '科学辩论',
    'Society': '社会模拟',
    'Gaming': '游戏',
    'Psychology': '心理学',
    'RecommenderSystem': '推荐系统',
    'PolicyMaking': '政策制定',
}
guo_t2_final = []
for cells in guo_t2_rows[1:]:
    if len(cells) < 3:
        continue
    domain = domain_map2.get(cells[0], cells[0])
    datasets = cells[1].replace(';', '；')
    used = cells[2]
    guo_t2_final.append([domain, datasets, used])

guo_t2_md = ('## 附录：表 2 常用数据集与基准（中译）\n\n'
             + md_table(['领域', '数据集/基准', '使用文献'], guo_t2_final)
             + '\n')


# ---------- Guo 2024: references ----------
guo_ref_start = guo.index('References', guo.index('References\n'))
guo_refs = guo[guo_ref_start + len('References'):]
guo_refs = re.sub(r'===== PAGE \d+ =====\s*', '', guo_refs)
guo_ref_items = []
for m in re.finditer(r'(?m)^\[([^\]]+)\]\s*(.*?)(?=^\[[^\]]+\]\s|\Z)', guo_refs, re.S):
    key = m.group(1)
    body = re.sub(r'\s+', ' ', m.group(2)).strip()
    if body:
        guo_ref_items.append((key, body))

guo_ref_md = '## 附录：参考文献（原文条目，未翻译）\n\n'
if guo_ref_items:
    for key, body in guo_ref_items:
        guo_ref_md += f'- [{key}] {body}\n'
else:
    guo_ref_md += '（参考文献从 PDF 两栏正文中提取，格式较乱，建议直接查阅原文 PDF。）\n'


# ---------- 写回 ----------
li_doc = read(LI_TRANSLATION)
li_doc = li_doc.replace(
    '本文档为该论文的完整中文翻译，仅包含正文逐节翻译，不含解读、整理或附录。英文术语首次出现时保留原文，便于回查。参考文献为文献条目，按原文保留在文末。',
    '本文档为该论文的完整中文翻译，仅包含正文逐节翻译与原文表格/缩写/参考文献，不含解读、整理或应用映射。英文术语首次出现时保留原文，便于回查；表格与缩写已中译，参考文献按原文条目保留在文末。')
li_doc = li_doc.rstrip() + '\n\n---\n\n# 附录\n\n' + li_abbr_md + '\n' + li_t1_md + '\n' + li_t2_md + '\n' + li_ref_md
write(LI_TRANSLATION, li_doc)

guo_doc = read(GUO_TRANSLATION)
guo_doc = guo_doc.replace(
    '本文档为该论文的完整中文翻译，仅包含正文逐节翻译，不含解读、整理或附录。英文术语首次出现时保留原文，便于回查。参考文献为文献条目，按原文保留在文末。',
    '本文档为该论文的完整中文翻译，仅包含正文逐节翻译与原文表格/参考文献，不含解读、整理或应用映射。英文术语首次出现时保留原文，便于回查；表格已中译，参考文献按原文条目保留在文末。')
guo_doc = guo_doc.rstrip() + '\n\n---\n\n# 附录\n\n' + guo_t1_md + '\n' + guo_t2_md + '\n' + guo_ref_md
write(GUO_TRANSLATION, guo_doc)

print('LI refs parsed:', len(li_ref_items))
print('GUO table1 rows:', len(guo_t1_final))
print('GUO table2 rows:', len(guo_t2_final))
print('GUO refs parsed:', len(guo_ref_items))
print('ABBR rows:', len(unique))
