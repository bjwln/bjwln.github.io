---
title: OpenClaw
date: 2026-05-30 10:35:30
tags:
categories: 好玩的技术
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBjEFqGwd-MLzGQjkpsVDH8WKUB-PLHwACawxrG82J2UTWh-1iEklzUwEAAwIAA3gAAzsE.png
permalink: 2026/05/30/openclaw/
---

# ①安装wsl及其目的

```powershell
wsl --install
```

1. OpenClaw 是 Linux 原生架构

   OpenClaw 的核心模块（Gateway、Agent、Skills、Memory）依赖 Linux 特有的东西：

   - systemd — 管理后台服务启动，Windows 原生不支持
   - Linux 文件权限模型 — 技能包挂载、配置文件读写全靠这个
   - Linux 系统调用 — 浏览器自动化、Shell 命令执行等底层都是 Linux API

   直接在 PowerShell 里裸装，大概率遇到编译报错、权限拒绝、依赖冲突三件套。

2. Docker Desktop 需要 WSL2（这是关键）

   Windows 上跑 OpenClaw 的主流方式是 **Docker 容器**，而 Docker Desktop for Windows 有两种后端：

   |          | WSL2 后端（推荐）                            | 传统 Hyper-V 虚拟机     |
   | -------- | -------------------------------------------- | ----------------------- |
   | 性能     | 接近原生 Linux                               | 损耗明显                |
   | 启动速度 | 秒级                                         | 慢，要启动完整 VM       |
   | 文件互通 | `/mnt/c` 直接访问 Windows 盘，localhost 直连 | 需要 SMB 共享，配置繁琐 |
   | 资源占用 | 动态共享，空闲时极低                         | 预先固定分配（如 2GB）  |

   OpenClaw 部署中的数据卷挂载（如 `~/.openclaw` 目录）和端口访问（`localhost:8080`）**全部依赖 WSL2 的文件系统互通和网络透明性**。

3. WSL2 比虚拟机轻太多
   - 不用开完整的 VM，不用分配固定内存
   - Windows 和 Linux 文件系统双向互通（`\\wsl$\Ubuntu` 和 `/mnt/c`）
   - 可以直接从 PowerShell 调用 `docker`、`wsl` 命令

3. 以后要进入这个系统只需要powershell里输出`wsl`就可以了

   

# ②安装Openclaw本体

[官网](https://openclaw.ai/)

根据官网提供的安全文档来安装这个系统

![image-20260530221427015](/images/image-20260530221427015.png)

安装完成后会询问：此操作有一定的风险![image-20260530225159993](/images/image-20260530225159993.png)

然后选择大语言模型，配置API

![image-20260530225557862](/images/image-20260530225557862.png)

![image-20260530225726332](/images/image-20260530225726332.png)

选择Keep current 

![image-20260530225835367](/images/image-20260530225835367.png)

选`Skip for now (You can add channels later via: openclaw channels add)`，跳过移动端接入，回车

![image-20260530225930809](/images/image-20260530225930809.png)

然后继续Skip for now![image-20260530230010277](/images/image-20260530230010277.png)

不接入skill，等去github上拉几个好玩的再安装

![image-20260530230102512](/images/image-20260530230102512.png)

钩子也不用现在装

![image-20260530230119503](/images/image-20260530230119503.png)

你想从哪打开openclaw：选择终端（Terminal）

![image-20260530230500840](/images/image-20260530230500840.png)

可以从上方进入浏览器的open claw的UI界面，复制Web UI（with token）给的地址进入

![image-20260530230709784](/images/image-20260530230709784.png)

![image-20260530230825220](/images/image-20260530230825220.png)

# ③为龙虾配置Skill

[技能市场](https://clawhub.ai/)

常用指令：powershell里输入这些命令

![image-20260530232252456](/images/image-20260530232252456.png)

例如配置Tavily Searchskill，首先在技能市场搜索Tavily Search

![image-20260530232444206](/images/image-20260530232444206.png)

![image-20260530232603970](/images/image-20260530232603970.png)

![image-20260530232709517](/images/image-20260530232709517.png)

![image-20260530233153120](/images/image-20260530233153120.png)

![image-20260530233452619](/images/image-20260530233452619.png)

接下来可问一些天气，股票之类的问题。openclaw会自动联网搜索并给你结果
