---
title: 文献阅读规划（10篇）
date: 2026-08-16 16:38:13
type: research-planning
top_img: false
aside: false
comment: false
description: Multi-agent system for MDT 的文献阅读规划
cover: cover.jpg
cover_fit: contain
---

> 这一组决定你对"多智能体""MDT""综述定位"的基本理解。读的时候不要追求记住每个细节，要追求"能用自己的话讲清楚一个完整故事"。

# 目录

| #    | 文献（按参考编号）                                           | 论文原名称                                                   | 对应综述章节      | 要学到的核心内容                                             | 流程图                                                       |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------ | ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 1    | 54. Li, X. et al. (2024) LLM-based MAS: workflow, infrastructure, challenges | A survey on LLM-based multi-agent systems: workflow, infrastructure, and challenges | 3.1、4.5          | 多智能体从工作流、基础设施、挑战三个角度的全景框架           | 认识 Agent 的零件：agent可以被分类成什么？<span style="color:#FF00FF">（定义）</span> |
| 2    | 96. Yao et al. (2026) AI hospitals survey                    | LLM-based multi-agent systems for clinical workflows: a survey of AI hospitals | 3.1、3.3、3.5     | 医疗多智能体如何组织临床工作流；AI 医院类模拟环境如何评测    | 提出 AI hospital概念：将AI医院定义为工作流级临床系统<span style="color:#FF00FF">（流程落地）</span> |
| 3    | 92. Xiong et al. (2026) MAS for medicine: accountable orchestration | Not just one agent: LLM-based multi-agent systems for medicine from answer generation to accountable workflow orchestration | 3.1、4.1          | 医疗多智能体从"生成答案"到"工作流编排"的演变；可问责性       | 把医学 MAS 从“能跑医院流程”推进到“能被审计、被追责、被治理”。<span style="color:#FF00FF">（落地审查）</span> |
| 4    | 84. Tang et al. (2024) MedAgents                             | MedAgents: large language models as collaborators for zero-shot medical reasoning | 3.2.1、3.4        | 最早的医疗多智能体框架之一：角色化、协作讨论、零样本推理     | 医疗多智能体框架<span style="color:#FF00FF">（早期agent落地）</span> |
| 5    | 43. Kim et al. (2024) MDAgents                               | MDAgents: an adaptive collaboration of LLMs for medical decision-making | 3.2.1、3.2.3、3.4 | 自适应协作：根据任务难度选择独诊/团队；这是"协作+层级"的交界 | 自适应协作解决了什么问题？它和固定团队的区别？               |
| 6    | 13/15. Chen, K. et al. MDTeamGPT (2025/2026)                 | MDTeamGPT: a self-evolving LLM-based multi-agent framework for multi-disciplinary team medical consultation；MDTeamGPT: mitigating context collapse and enabling self-evolution in medical multi-agent reasoning | 3.2.4、3.4、3.6.2 | 共识聚合+残余讨论+知识库；"上下文崩塌"问题                   | 上下文崩塌是什么？系统怎么缓解？                             |
| 7    | 58. Liu, Q. et al. (2026) EvoMDT                             | EvoMDT: a self-evolving multi-agent system for structured clinical decision-making in multi-cancer | 3.2.4、3.4、4.2   | 自进化 MDT 系统：根据专家反馈和结局信号更新提示词、权重、检索范围 | 自进化在 MDT 中如何实现？它和普通多智能体的差异？            |
| 8    | 85. Vasilev et al. (2025) MTBBench                           | MTBBench: a multimodal sequential clinical decision-making benchmark in oncology | 3.5、4.4          | 肿瘤会诊专用基准：多模态、纵向、证据调和                     | MTBBench 为什么比通用基准更适合 MDT？它测出了什么失败？      |
| 9    | 104. Zhu, Y. et al. (2025) MedAgentAudit                     | Auditing medical multi-agent AI reveals risks of false consensus | 3.2.2、3.6.1、4.5 | 审计多智能体执行日志；虚假一致、沉默同意、未激活专科推理     | 审计发现了哪几类协作失败？为什么"辩论"不一定可靠？           |
| 10   | 27. Gallifant et al. (2025) TRIPOD-LLM                       | The TRIPOD-LLM reporting guideline for studies using large language models | 3.6.4、4.5        | LLM 研究报告的最低报告要求                                   | TRIPOD-LLM 有几个条目？它如何支撑你综述的"评测不足"论点？    |

---
