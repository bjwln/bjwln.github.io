---
title: Outputs
date: 2026-11-14 00:00:00
research: Small-pro
research_order: 3
description: 保障当程序的安全性和结果的可复现性
---

# 数据集

| 数据集        | 原始池总量         | 可封装为 valid                                  | 可封装为 test                                            |
| ------------- | ------------------ | ----------------------------------------------- | -------------------------------------------------------- |
| MedQA         | 11,451             | 未动段 test[100:] = 1,173（建议划 50-100 入岗） | 未动段 1,173 + 已消耗 100（锚点）                        |
| DDXPlus       | 266,977            | validate 池 132,448（在岗 50）                  | test 池 134,529（在岗 100，定型期扩 500）                |
| MedChain      | 12,163             | 纯文本池 6,816（待划分）                        | 同一池（划分方案定型期定）                               |
| MedAgentBoard | 2,279（processed） | ❌                                               | 官方考卷 400（MedQA MC 200 + PubMedQA MC 200，文本可用） |
| 总计          | 292,870            | —                                               | —                                                        |

## DDXPlus

Mila 研究所造的约 130 万合成虚拟患者（NeurIPS 2022 D&B track，CC-BY 许可）。每个患者有：年龄/性别、金标准诊断（PATHOLOGY）、编码化的症状与病史（EVIDENCES）、主诉起点，以及最值钱的——带概率的鉴别诊断列表（DIFFERENTIAL_DIAGNOSIS）。鉴别诊断就是 MDT 会诊的核心思维动作，而且 MDAgents 原文就用它评测

| 文件                            | 是什么                                                       | 要不要                   |
| :------------------------------ | :----------------------------------------------------------- | :----------------------- |
| `release_evidences.json`        | 症状/病史字典（编码→中文问题的映射）【用于解码，把论文源数据给解码成能用的数据】 | 下                       |
| `release_conditions.json`       | 病理字典（病名/ICD-10/严重度）【用于解码，把论文源数据给解码成能用的数据】 | 下                       |
| `release_test_patients.zip`     | 官方测试划分                                                 | 下                       |
| `release_validate_patients.zip` | 官方验证划分                                                 | 下                       |
| ~~release_train_patients.zip~~  | 百万级训练集，最大的文件                                     | 跳过，因为模型不需要训练 |

**转换为本地agent程序能读懂的json文件**

以后要是用于测试项目，需要把生原料给转化一下

| 层                         | 文件                                                         | 谁会读它                   |
| -------------------------- | ------------------------------------------------------------ | -------------------------- |
| 论文原数据                 | release_conditions.json、release_evidences.json、release_test_patients、release_validate_patients | 只有 prepare_ddxplus.py 读 |
| 处理过后可以直接识别的数据 | train.jsonl、valid.jsonl、test.jsonl                         | benchmark.py 只读这三个    |



## MedChain

港城大/港中文的 12,163 例经人工验证的真实临床病例（NeurIPS 2025），19 专科、含 7,338 张带报告的图像。每例走 转诊→问诊→检查→诊断→治疗 五步，作者的结论（单 agent 序列任务错误传播严重，多 agent+反馈显著更好）正是系统要验证的假设。

## MedAgentBoard

NeurIPS 2025 D&B track 的 benchmark，专做“多智能体 vs 单 LLM vs 传统方法”四类任务对比（医学问答/科普摘要/EHR 预测/工作流自动化）。它最值钱的不只是数据，是实验设计的模板。它证明多智能体并非总赢，所以每个设计都要配对实验背书。内容包含：

| 任务类别         | 子集                            | 条数    | 你的 benchmark 能不能用                                      |
| ---------------- | ------------------------------- | ------- | ------------------------------------------------------------ |
| 医学 MC 问答     | MedQA                           | 200     | ✅ 几乎零成本（qid/question/options/answer，与你格式同构，选项 A-E） |
| 医学 MC 问答     | PubMedQA                        | 200     | ✅ 同上（A/B/C 三选）                                         |
| 自由文本问答     | PubMedQA FF                     | 200     | ⚠️ 能跑但判分不同（无选项字母，要文本比对）                   |
| 病理/放射图像 QA | PathVQA + VQA-RAD               | 400+379 | ❌ 刚验证：带 image_path 字段，问题离开图像没有意义——留给多模态阶段 |
| 科普摘要生成     | 5 个子集                        | 各~100  | ⚠️ 生成任务，指标是 ROUGE/BERTScore，另一套管线               |
| EHR 预测         | mimic-iv 死亡/再入院 + TJH 死亡 | 各 200  | ⚠️ 时序数据预测（有意思的是 MIMIC 部分居然在里面，README 说不含——用前需查合规形式） |

## VQA-RAD

**医疗视觉问答（Med-VQA）领域的开山数据集**：放射科医生针对真实放射影像提出的临床问题 + 答案对，是该领域第一个由临床医生人工构建的问答集，也是本课题多模态扩展（阶段九）的部件级验证数据集。

|          | 原始版（OSF）                               | HF 版（实际用）                                              |
| -------- | ------------------------------------------- | ------------------------------------------------------------ |
| QA 对    | 3,515（约每图 10 问）                       | 2,244（train 1,793 + test 451，是原始版的处理子集）          |
| 图像     | 315 张（头/胸/腹，已脱敏）                  | train 内唯一图像 313 张（与 test 有重叠），全部 JPEG，实测可解码 |
| 字段     | —                                           | image{bytes, path} + question + answer                       |
| 答案风格 | 开放式 + 封闭式（yes/no、计数、定位词）混合 | yes/no 占主导，另有 axial、right、pa 等定位词                |
| split    | —                                           | 只有 train / test，没有 validation                           |



## GMAI-MMBench

迄今最全面的通用医疗 AI 多模态评测基准（官方自称，检索属实）：284 个源数据集、38 种影像模态、18 个科室、18 类临床任务整合成的选择题式 VQA 基准，本课题阶段九多模态扩展的主力数据集（端到端评测用）。

| 项           | 内容                                                         |
| ------------ | ------------------------------------------------------------ |
| 论文         | GMAI-MMBench: A Comprehensive Multimodal Evaluation Benchmark Towards General Medical AI |
| 作者团队     | Pengcheng Chen、Jin Ye、Guoan Wang 等 19 人，上海人工智能实验室（OpenGVLab） 联合 Monash、上交等 |
| 发表         | NeurIPS 2024 Datasets and Benchmarks Track（官方更新日志原文："Accepted by NeurIPS 2024 Datasets and Benchmarks Track!"） |
| arXiv        | 2408.03361                                                   |
| 数据地址     | huggingface.co/datasets/OpenGVLab/GMAI-MMBench（gated：需登录同意条款 + 本地配 HF_TOKEN） |
| 下载文件     | 只需 README.md + GMAI_mm_bench_VAL.tsv（9.34 GB）；TEST 11 个分片（~43 GB）无答案列，不下载 |
| 本地文件指纹 | -                                                            |
| 总题量       | 4,550（VAL，带答案）                                         |
| 源构成       | 284 个数据集 = 268 公开 + 16 家医院（伦理审批后共享），统一图像格式与标签表达后整合 |
| 维度         | 38 种医学影像模态 × 18 个临床科室 × 18 类 VQA 任务 × 4 种感知粒度 |
| 格式         | TSV，图像以 Base64 内联（cv2 编码 PNG → base64，所以文件巨大）；列含 question、选项、answer（仅 VAL）、科室/模态/任务字段（lexical tree 筛选靠它们，具体列名以表头为准） |
| VAL vs TEST  | VAL 带金标（README 原文："we have included an 'answer' column in the VAL data, while removing the 'answer' column from the Test data"）；TEST 答案被抽走，评测需邮件作者团队上官方榜 |

## MedXpertQA

专家级医疗推理基准（Text + MM 双子集，全部对齐美国专科委员会考试难度），目前该难度级别的最强基准之一；本课题阶段九的泛化验证数据集——GMAI-MMBench 出主结果，它回答“换一个更难、更接近真实考试风格的基准，结论还成不成立”。

| 项           | 内容                                                         |
| ------------ | ------------------------------------------------------------ |
| 论文         | MedXpertQA: Benchmarking Expert-Level Medical Reasoning and Understanding |
| 作者团队     | Zuo Yuxin、Qu Shang、Ding Ning、Zhou Bowen 等，清华大学 TsinghuaC3I 团队 |
| 发表         | ICML 2025（2025-05-06 录用，官方仓库标题原文 "[ICML 2025]"） |
| arXiv        | 2501.18362                                                   |
| 许可         | MIT（最宽松，可自由用于研究）                                |
| 数据地址     | huggingface.co/datasets/TsinghuaC3I/MedXpertQA（公开非 gated）；官方代码仓库 github.com/TsinghuaC3I/MedXpertQA |
| 已集成       | OpenCompass（2025-04-08 官方公告）                           |
| 本课题实际用 | data/MedXpertQA-图像/（MM 子集 + images/ 全部解压）          |

**数据集规模**

| 子集           | dev  | test  | 合计  | 与论文对账           |
| -------------- | ---- | ----- | ----- | -------------------- |
| Text（纯文本） | 5    | 2,450 | 2,455 | ✓                    |
| MM（多模态）   | 5    | 2,000 | 2,005 | ✓                    |
| 合计           | 10   | 4,450 | 4,460 | ✓ 与论文口径完全一致 |

- 字段：`id, question, options(A–E), label(金标), images, medical_task, body_system, question_type`
- 答案覆盖：全部 4,455 条本地可评（`label` 列无一缺失，分布均衡：A 399 / B 408 / C 383 / D 386 / E 424）——比 GMAI 体验好，TEST 答案就地可评，不用邮件求分
- MM 题型：Diagnosis 1,199 / Treatment 448 / Basic Science 353
- 图像：`images/` 共 2,858 张（500.3 MB），与 2,005 道多模态题的引用零缺失（1:1 全命中）；一题可带多图（文件名 `-a/-b/-c` 后缀）

# Outputs

## Prompt产出结果

A组`ddxplus_valid50_基线_temp0`：原始系统，prompt 内联、无 CaseContext、意见是自由文本

![image-20261114202617297](Outputs/image-20261114202617297.png)

B组`ddxplus_valid50_B_`：A + 协议化 + 病例上下文 + 结构化意见,讨论还是旧 discuss()

![image-20261115122242154](Outputs/image-20261115122242154.png)

C组`ddxplus_valid50_C`：默认沉默、有理由才发言，发言进共享记忆

![image-20261115152628076](Outputs/image-20261115152628076.png)

D组`ddxplus_valid50_D1_阶段六.json`三态共识：决策层程序化 + 证据层 LLM 评估 + safety 否决停止

![image-20261117002120259](Outputs/image-20261117002120259.png)
