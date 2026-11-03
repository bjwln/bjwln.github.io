---
title: Prompt优化
date: 2026-11-03 00:00:00
research: Small-pro
research_order: 1
description: 使用统计学方法新加对比函数，并尝试进行提示词的优化来优化生成时间和生成所使用的token
---

 [原文.pdf](Prompt优化\CVPR26_VideoHV_hypothesis_verification.pdf) 

Wang Z., et al. Think, Then Verify: A Hypothesis–Verification Multi-Agent Framework for Long Video Understanding. *CVPR 2026.*2026 年 6 月 7 日，CVPR 2026 正式接收

# Compare

在优化提示词之前，首先我们要有一个比较函数用于比较优化前和优化后的程序。即改了提示词之后，程序判断这次改动是真有用，还是只是运。

**比较的过程**

- 旧提示词答对、新提示词答对   → 这题没变化，不用管（不管多少题）
- 旧提示词答错、新提示词答对   → 改动修好了这题   ← 挑出来
- 旧提示词答对、新提示词答错   → 改动改坏了这题   ← 挑出来
- 两次都答错                  → 没变化，不用管

compare.py 自动完成这个过程，打开两个结果文件，按题号配对，把“变好”和“变坏”的题各自列出来，最后算一个**运气概率**——如果纯粹靠运气也能出现这么偏的结果，这个概率是多大。运气概率很小（比如 3%），我们才敢说“改动真的起了作用”；运气概率很大（比如 50%），结论只能是“看不出变化”。

## mcnemar_exact_p(b: int, c: int) -> float

本函数为统计函数，跑完 A/B 两次实验后，手里面有这些数据

​              	  B 对    		 B 错

​    A 对    	   265      		2   ← 退化题（A对B错）

​    A 错     	   10     		 23  ← 提升题（B对A错）
