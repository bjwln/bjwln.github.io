---
title: Codex
date: 2026-06-15 15:03:43
tags:
categories: Tools
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBjwlqMAhYr0WtDkEzS2sUfJtQ1nLE_QACIAxrG3UggUV20latvjMWjAEAAwIAA3gAAzwE.png
---

Codex是2025年10月[OpenAI](https://baike.baidu.com/item/OpenAI/19758408?fromModule=lemma_inlink)公司开发的AI代码生成训练模型，基于[GPT-3](https://baike.baidu.com/item/GPT-3/63687636?fromModule=lemma_inlink)架构改进，专注于将自然语言指令转换为多种编程语言代码。该模型通过混合训练自然语言和公开代码数据构建，采用[Transformer](https://baike.baidu.com/item/Transformer/64429264?fromModule=lemma_inlink)架构并具备14KB代码记忆容量，支持[Python](https://baike.baidu.com/item/Python/407313?fromModule=lemma_inlink)、[JavaScript](https://baike.baidu.com/item/JavaScript/321142?fromModule=lemma_inlink)、[Java](https://baike.baidu.com/item/Java/85979?fromModule=lemma_inlink)等主流语言，作为[GitHub Copilot](https://baike.baidu.com/item/GitHub Copilot/57754203?fromModule=lemma_inlink)的技术基础，核心功能包括代码生成、补全优化及多语言翻译。2025年5月升级为云端软件工程代理后，新增并行处理代码编写、调试和测试功能，集成至[ChatGPT](https://baike.baidu.com/item/ChatGPT/62446358?fromModule=lemma_inlink)生态并向企业用户开放。同年6月通过ChatGPT Codex子系统实现多方案生成功能，允许用户为单一任务获取多个代码方案并自主选择最优解。

![image-20260615222538979](image-20260615222538979.png)

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

# 关于本地路由映射

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

# 可能会遇到的一些问题



## 手机验证码问题

![image-20260615205123522](image-20260615205123522.png)

目前主流的绕开验证码的方式全都失效了，唯一能用的就是接码平台了。但是接码平台的号码无法二次验证。很可能有二次验证的时候这个号就废了。看看以后会不会有更好的解决方法

## 因为编的次数太多了，直接新建一个标题

![image-20260615210046180](image-20260615210046180.png)

问题原因：你开了魔法，codex未必一开始就走魔法，而是会尝试直接访问，try五次之后，再走代理。设置env的目的是让codex一开始就知道有这个配置，直接走代理即可。 也可以直接设置环境变量，一个道理。一个是用户级别的，一个是软件级别的

解决方法：windows用户进c盘/用户/你的用户名/.codex 进入文件夹创建一个“.env”文件，然后把下面这段复制粘贴进去就解决了：

HTTP_PROXY=http://127.0.0.1:7890 

HTTPS_PROXY=http://127.0.0.1:7890 

ALL_PROXY=http://127.0.0.1:7890 

NO_PROXY=localhost,127.0.0.1

魔法的端口可以在app内找到

![image-20260615204722173](image-20260615204722173.png)

二编：

​	好像我得先进入命令窗口页面，然后我在可视化界面才能正常提问问题。。。

​	![image-20260615211757766](image-20260615211757766.png)

​	![image-20260615211812070](image-20260615211812070.png)

三编：

​	1min717万token还没命中率，这太逆天了。花token如流水，等以后真订阅codex再用这个软件吧。也可能是用的国内的大模型的原因。<span style="color:#FF00FF">可能真订阅了它的服务会更有生产力且性价比更高</span>

​	![image-20260615214806022](image-20260615214806022.png)

​	![image-20260615215015194](image-20260615215015194.png)

四编：

​	plus 20刀/月

​	pro 200刀/月

​	<span style="color:#FF00FF">cc是真的好用</span>

五编：

​	codex插件真好用，<span style="color:#FF00FF">出现重新连接问题关掉魔法后打开codex就可以了。</span>

六编：

​	我的token‌  **༎ຶД༎ຶ`**

七编（2026/6/23）：

​				开机  - >  打开ccswitch（选择火山的codingplan计划，日日新的感觉好像不可以）-> 打开codex++管理器  ->  启					动codex++。这样就可以用插件也能用自己的APIkey了



