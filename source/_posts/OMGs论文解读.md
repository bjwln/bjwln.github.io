---
title: OMGs论文解读
date: 2026-08-02 14:58:59
tags:
categories: Multi-agent system for MDT
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBmM1qbvXaJmmiG4udMCE0TW9N4RbbWwACgwxrGzeJeUcs8HfzSs6e7gEAAwIAA3gAAz0E.png
---

# 背景

## 现实医学背景

> MDT：MDT 的全称是 Multidisciplinary Team，可理解为多学科团队协作。团队通常包含外科、肿瘤内科、放疗科、影像科、病理科等医生，有时护士、营养师、心理医生也会加入。大家围坐讨论，避免单一科室决策的局限。

卵巢肿瘤的管理越来越依赖于多学科肿瘤委员会MDT的讨论，以应对需要手术、肿瘤内科、影像、病理、分子检测多学科协同治疗。并且此病症有三个特别棘手的特征：晚期诊断、显著的肿瘤异质性、频繁复发。这些特征意味着患者在整个病程里需要反复面对高风险决策。然而全球大多数患者缺乏及时的专家共识,尤其在资源受限的中心。MDT 资源稀缺甚至完全不可用。

于是，本文提出了OMGs（卵巢肿瘤多学科智能体系统），多智能体AI框架，通过协调多学科的证据，用于给出透明依据的MDT式的建议

## Agent背景

> **初步管理**：病人刚确诊卵巢肿瘤,要决定怎么治。最核心的决策通常是:
>
> - 直接手术(PDS):先开刀尽量切干净肿瘤,再化疗;
> - 先化疗再手术(NACT+IDS):肿瘤太大或扩散太广,先用化疗缩小,再做手术。
>
> **组织学驱动的路径**：手术或活检拿到病理组织学类型后,不同类型的卵巢肿瘤走完全不同的治疗路线:
>
> - 高级别浆液性癌：化疗+维持治疗(PARP 抑制剂/贝伐珠单抗),看 BRCA/HRD;
> - 透明细胞癌：化疗效果差,处理更激进;
> - 生殖细胞肿瘤：用 BEP 方案,要考虑保生育;
> - 性索间质肿瘤：可能不需要化疗;
> - 交界性肿瘤：通常手术就够了,不化疗。
>
> **铂类耐药复发**：病人治疗后癌症复发了,而且对铂类化疗药已经耐药(定义:完成铂类化疗后 6 个月内复发)。铂类是卵巢癌的基石药物,一旦耐药,可选择的方案很少,是临床最棘手的情况。
>
> **铂类敏感复发**：病人复发了,但对铂类仍然敏感(定义:完成铂类化疗后 超过 6 个月才复发)。这种情况可以再用铂类化疗,选择更多、预后更好。

1. 用agent进行仿照MDTs的讨论得出对病人的具体分析，这项任务具有多学科性，需要跨专业进行针对特定角色的推理，并在解释出现分歧时进行协调。
2. 在整个护理过程中，决策空间会随着临床场景的变化而变化，包括初步管理、组织学驱动的路径、铂类耐药复发、铂类敏感复发以及事件驱动的重新评估。
3. 输入agent数据具有纵向性，且可能不完整，分布在时间顺序的报告中，存在数据缺失、不确定性和评估不一致的情况。
4. 临床部署需要透明度和可追溯性，将建议与可验证的患者特异性证据联系起来，并明确指出不确定性和重新评估，以支持问责和审计。

# OMGs系统的实现

## 使用OMGs的原因

### LLM天然适配MDTs

> Such systems naturally fit the MDTs and enable seamless integration of multimodal clinical data, external knowledge bases, and case repositories through coordinated tool use, while reconciling conflicting perspectives via structured reasoning and evidence attribution.
>
> 此类系统自然契合多学科团队（MDTs）的需求，通过协同使用工具，实现多模态临床数据、外部知识库和病例库的无缝集成，同时通过结构化推理和证据归因来调和相互冲突的观点。

### 比单智能体更有效率

> Compared with single-agent approaches, a multi-agent design may better structure role-specific reasoning and facilitate evidence-grounded reporting, which is hypothesized to improve auditability under fragmented records.
>
> 与单agent相比，多agent设计可能更有利于构建特定角色的推理结构，并促进基于证据的报告，这被认为可以提高零散记录下的可审计性。
>
> **可审计性**：当病历又碎又缺时,多 agent 把推理拆成几个角色各自负责的部分,缺口和矛盾被不同 agent 显式挑出来,而不是埋在一个黑箱里--这样事后追溯"建议怎么来的、哪里可能出错"就更容易。

## OMGs的系统组成

![image-20260805001554263](OMGs论文解读/image-20260805001554263.png)





# 创新点1：SPEAR评估系统

本系统开发了一个<span style="color:#FF00FF">**SPEAR评估框架**</span>用于系统性评估OMGs的建议质量。并通过这个框架用于展示OMGs和真实MDT的性能比较结果。本框架使用五个维度评分标准进行评估

| 维度                    | 含义                            | 备注 |
| ----------------------- | ------------------------------- | ---- |
| Safety(安全)            | 建议有没有高危错误              |      |
| Personalization(个性化) | 有没有结合这个病人的具体特征    |      |
| Evidence(证据)          | 证据强不强、能不能追溯到来源    |      |
| Actionability(可操作性) | 建议能不能直接落地执行          |      |
| Robustness(稳健性)      | 对缺失/矛盾信息有没有识别和兜底 |      |

**第一阶段的评分**

三位具有常规MDT实践的妇科肿瘤专家独立对每个病例进行评分，每个维度使用中位数评分

**第二阶段**

> From Phase II onward, to avoid self-scoring when comparing OMGs with human MDT conclusions, SPEAR scoring was performed by an independent senior expert consensus panel that did not participate in the MDT or re-MDT discussions.
>
> self-scoring：参加 MDT 讨论的人,不能又来给 MDT 和 OMGs 的对比打分。可能参与MDT讨论的人会偏向自己的团队，从而给OMGs打低分。或者他可能"刻意公平"反而给 OMGs 打太高来满足补偿心理。
>
> re-MDT：一批没参与过当时MDT的资深医生,用同样的病例资料重新讨论一遍。相比较于MDT病人真正治疗决策时的讨论，re-MDT聚焦于研究阶段,回顾性地重新讨论。



# 



