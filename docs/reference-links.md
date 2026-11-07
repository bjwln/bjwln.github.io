# 外部项目参考链接

> 记录关注中的开源项目，便于跟进更新。新项目往下面追加即可。
> 最后核对：2026-11-08。

---

## HypoMux

- **仓库**：<https://github.com/Hypostasis-Cat/HypoMux>
- **Releases（最新安装包）**：<https://github.com/Hypostasis-Cat/HypoMux/releases/latest>
- **国内镜像**：<https://cnb.cool/Hypostasis-Cat/HypoMux/-/releases/latest>
- **官网 / 文档**：<https://hypomux.com>
- **当前版本**：v2.8.2（2026-10-24 发布；2026-11-08 核对，项目更新频繁，用时以 Releases 页为准）
- **是什么**：面向 Windows 的开源多网卡聚合与分流工具。技术栈 Go + Wails v3（桌面框架）+ React/Fluent UI。功能是把多连接下载任务分配到多张活动网卡（有线、Wi-Fi、手机热点、USB 网络共享），提升 Steam / IDM / WeGame / 浏览器大文件下载等高并发场景的吞吐。依赖 Wintun 虚拟网卡驱动、sing-box TUN 内核、Windows 系统代理/WFP 等系统级能力。
- **形态**：Windows 桌面安装包（`HypoMux_Setup_*.exe`），**不是网页项目**。
- **与摸鱼页的关系**：❌ 无法集成进 Hexo 摸鱼页——它是需要驱动与系统网络权限的桌面程序，浏览器/网页沙箱拿不到网卡，也没有可嵌入的 JS 组件；网页上"仿写"同样不成立（多网卡聚合的核心是把套接字绑定到不同物理网卡，这是操作系统网络栈的能力）。如需使用，直接在自己电脑上安装。
