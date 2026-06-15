---
title: Codex
date: 2026-06-15 15:03:43
tags:
---

# 安装

## 命令行安装

`npm install -g @openai/codex`

![image-20260615152335348](image-20260615152335348.png)





## 官网下载

https://openai.com/zh-Hans-CN/codex/（需要魔法）

![image-20260615152316000](image-20260615152316000.png)

# 登录

输入codex自动进入登陆界面

![image-20260615153155820](image-20260615153155820.png)

登录后，认证信息会保存在`~/.codex/auth.json` 文件中，默认使用`GPT-5`模型。可以通过`/model`命令来切换`GPT-5`模型的不同版本，推荐使用`GPT-5 high`。

注意ChatGPT 账户限额，参考: https://chatgpt.com/zh-Hans-CN/pricing

## 一些混淆点

1. Codex 原生只认 OpenAI 的模型，显示的是 “本地兼容后的假象”

   Codex（OpenAI 的代码助手 CLI）**原生只支持 OpenAI 自己的 Responses API 和 GPT 系列模型**，它本身不认识 DeepSeek、Kimi 这类第三方模型，也不认识 CodingPlan 的 API。

   ![image-20260615163317770](image-20260615163317770.png)

   开启了「需要本地路由映射」，CC-Switch 正在做一件事：

   - 把你输入的 CodingPlan API，**伪装成 Codex 能识别的 OpenAI 协议**，让 Codex 以为自己在调用 GPT 模型
   - Codex 只知道 “这是一个 OpenAI 风格的模型”，就会默认显示它最高支持的模型名（比如 GPT-5.5），**这不是你实际开通了这个模型，只是 Codex 的默认显示**

   <span style="color:#FF00FF">那么ccswitch提供的自添加模型名就是修改codex给你显示的他所认为的模型名为实际调用的模型名称</span>

   ![image-20260615164311228](image-20260615164311228.png)

   <span style="color:#FF00FF">更换模型的时候还是从ccswitch上换比较好</span>

2. CodingPlan 本身没有 GPT-5.5 这个模型

   CodingPlan 是第三方 API 服务商，它的模型列表里只有自己支持的模型（比如 DeepSeek、Kimi、兼容 GPT-4 的模型），**根本没有 OpenAI 原生的 GPT-5.5**。

   - 你用 CodingPlan 的 API Key，只能调用它列表里已开通的模型
   - Codex 显示的 GPT-5.5，只是 CC-Switch 做了协议兼容后，Codex 自己 “脑补” 出来的模型名，和 CodingPlan 实际提供的模型无关

3. 「本地路由映射」这个开关的作用，就是解决 Codex 和第三方 API 不兼容的问题：
   - 当你用 DeepSeek、Kimi、CodingPlan 这类非 OpenAI 原生 API 时，它们大多只支持 `Chat Completions` 协议，而 Codex 只认 `Responses API`
   - 开启本地路由映射后，CC-Switch 会在你的电脑上运行一个本地代理服务，把 Codex 发出的 `Responses API` 请求，转换成第三方 API 能识别的 `Chat Completions` 请求，再把返回结果转换回去，让 Codex 以为自己在和 OpenAI 交互
   - 但这个过程只是**协议层面的兼容**，并不会凭空让你拥有 CodingPlan 没开通的模型权限

4. 同样CCswitch可以绕过codex登陆问题，不用魔法，不用手机号，不用支付

