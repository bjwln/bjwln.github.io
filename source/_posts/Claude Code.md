---
title: Claude Code
date: 2026-05-27 10:43:00
tags:
categories: Tools
cover: /images/cc.jpg
---

# ①安装Git Bash

# ②安装Claude Code本体

PowerShell中输入

```c
irm https://daheiai.com/cc.ps1 | iex
//来自：b站up主人工大黑
```

![image-20260527113304701](/images/image-20260527113304701.png)

# ③配置环境变量

<span style="color:red">作用：告诉操作系统在哪里可以找到可执行文件，这样你就可以在任何目录下直接运行命令，而不需要输入完整的文件路径。</span>

![image-20260527113856618](/images/image-20260527113856618.png)

输入Claude就可以快捷打开了

![image-20260527114027766](/images/image-20260527114027766.png)

# ④改变Claude code的依赖接口

安装CCswitch，用于改变Claude围绕的中间AI模型

![image-20260527114709612](/images/image-20260527114709612.png)

Claude、GPT 等模型可通过**[API中转站](https://api.daheiai.com/)**接入。

然后添加模型

![image-20260527123658656](/images/image-20260527123658656.png)

添加完模型之后就会发现命令行中可以正常使用

![image-20260527123211088](/images/image-20260527123211088.png)

![image-20260527115647133](/images/image-20260527115647133.png)

# ⑤用法：用于项目指导

![image-20260527124108036](/images/image-20260527124108036.png)

![image-20260527124212256](/images/image-20260527124212256.png)

<span style="color:red">当关闭掉终端，然后再回来的时候，可以输入`/resume`命令来找到之前的对话内容。</span>

<span style="color:red">当对话长度大于上下文长度，就需要通过输入`/compact`来压缩，但是很难恢复压缩前的上下文。</span>

# ⑥用法：文献查询功能

### Zotero的使用

安装zotero桌面版并且注册完之后，需要：

1. 去中文社区安装市场插件，装入zotero。以后所有的其余插件都可以在市场插件搜到

   ```
   https://zotero-chinese.com/plugins/#search=%E5%B8%82%E5%9C%BA
   ```

   ![image-20260527210859468](/images/image-20260527210859468.png)

2. 文献的初抓取

   - 安装浏览器扩展（zotero的官方链接，下图所示），安装茉莉花插件（从市场插件中安装）

   ![image-20260527212156114](/images/image-20260527212156114.png)

   - 找到一篇文章：https://arxiv.org/

   - 用浏览器的插件抓取到zotero中![image-20260527212952370](/images/image-20260527212952370.png)

     ![image-20260527213043138](/images/image-20260527213043138.png)

   - 如果抓取失败（反扒机制很好），那么只需要手动下载pdf，然后拖到zotero中就可以了

     ![image-20260527214359297](/images/image-20260527214359297.png)



   ### Claude Code进行论文查询

   1. 首先去让CC拉下来Github中zotero的自动化程序

      ```c
      https://github.com/54yyyu/zotero-mcp

      //Zotero-MCP 是一个基于 Model Context Protocol（MCP）的开源工具，允许 AI 助手（如 Claude、Cursor、Cherry Studio 等）安全地访问和操作本地 Zotero 文献库，实现文献搜索、元数据读取、全文（PDF）提取与 PDF 注释分析，无需手动上传文件。‌
      ```

   2. 打开zotero setup

      ![image-20260527214904059](/images/image-20260527214904059.png)

   3. 然后直接让CC给你查就行了



<span style="color:red">注意Claude Code只能访问本地的zotero，然后对本地的zotero中的论文进行管理，不能帮你爬取新的论文</span>