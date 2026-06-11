---
title: VoiceBox配音、音色克隆
date: 2026-05-31 18:41:58
categories: 好玩的技术
cover: /images/voicecover.png
---

Voicebox 由 Spacedrive 的开发者 Jamie Pine 主导，定位是"本地优先的 AI 语音工作室"。 

它把整个语音 I/O 链路一次性补齐了： 

- 输出端：7 个 TTS 引擎 + 50+ 预设音色 + 声音克隆 + 23 种语言 
- 输入端：全套 Whisper 转录 + 全局快捷键听写 
- 集成层：REST API + 内置 MCP 服务器，Claude Code、Cursor 这些智能体可以直接调用它说话

# 项目主页

https://github.com/jamiepine/voicebox

![image-20260531185601136](/images/image-20260531185601136.png)

![image-20260531193317795](/images/image-20260531193317795.png)

左侧导航栏介绍

![image-20260531211101281](/images/image-20260531211101281.png)

# 加速方法

加速Github和HuggingFace的修改DNS解析方法

1. 打开「设置」→「网络和 Internet」→「WLAN」或「以太网」，点击当前连接的网络。
2. 找到「IP 设置」，点击「编辑」。 
3. 选择「手动」，开启 IPv4。 
4. 首选 DNS 服务器： 223.5.5.5 备用 DNS 服务器： 223.6.6.6

# 模型调用

![image-20260601105128575](/images/image-20260601105128575.png)

![image-20260601105650013](/images/image-20260601105650013.png)

软件连不上github下载不了cuda，可以用cpu跑，但是跑起来会慢一点。

# 生成语音

![image-20260601110636303](/images/image-20260601110636303.png)

![image-20260601110745297](/images/image-20260601110745297.png)
