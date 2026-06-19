---
title: AgentSkills
date: 2026-06-19 14:40:13
tags:
categories: Tools
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBj45qNR0qaBmM_jdlKqqFlfXAcaJCEgACBwxrG8L8qUXEwGtMW3i_BAEAAwIAA3cAAzwE.png
---

# Playwright

github：https://github.com/microsoft/playwright#playwright-test

## 项目结构

![image-20260619144158845](image-20260619144158845.png)

支持两种自动化方式：

1. Playwright Test（内置Playwright CLI）+SKill
2. 本地CLI+Playwright MCP

## Playwright Test+Skill

如果不想每天都在Claude Code CLI中告诉他重复的操作（比如每天都需要浏览每日新闻提取关键字），最好把这些重复的操作封装成一个类似于个自动化脚本，以后每次上线都自动跑一遍，不用人管。提供的功能有：

| 你的需求                                       | 用哪个                                                   | 具体场景                                                     |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 帮我写一个登录测试（填写表单），以后每天自动跑 | Playwright Test（可以用Agent代写）                       | 我自己做了一个网站，然后我为了每天验证它的功能是否正常，然后每天让Playwright  Test+Skill来帮我填写相关的信息进行登录来debug |
| 帮我录一下操作，生成测试代码                   | 执行`npx playwright codegen`（手动操作，它自动生成代码） |                                                              |

（已经把测试文件的下载位置放到G:\PlayweightTest下了（不放在C盘））

### 安装Playwright Test

`npm init playwright@latest`：使用 Playwright 的脚手架工具创建一个新的测试项目。

这只是在你的电脑上创建了一个 Playwright 测试项目，你可以：
  - 手动写测试脚本

  - 用 npx playwright codegen 生成测试

    ```python
    # 1.模拟真实用户在浏览器中的操作，验证你的网站/应用是否正常工作：
     // tests/example.spec.js 示例
      const { test, expect } = require('@playwright/test');
    
      test('登录测试', async ({ page }) => {
        await page.goto('https://your-app.com/login');
        await page.fill('#username', 'testuser');
        await page.fill('#password', 'password123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/dashboard');
      });
    # 2.跨浏览器测试
    # 一次测试，在多个浏览器上自动运行：
    #  ┌─────────┬──────────┐
    #  │ 浏览器  │   引擎   │
    #  ├─────────┼──────────┤
    #  │ Chrome  │ Chromium │
    #  ├─────────┼──────────┤
    #  │ Firefox │ Gecko    │
    #  ├─────────┼──────────┤
    #  │ Safari  │ WebKit   │
    #  └─────────┴──────────┘
    
    # 3.自动截图和录屏
    # 测试失败时自动保存截图和视频，方便调试。
    
    # 4.生成测试脚本
    # 用 npx playwright codegen <URL> 可视化录制操作，自动生成测试代码。
    ```

    

  但 agent 还不能直接控制浏览器，因为没有权限调用 Playwright 的 API。



![image-20260619145132762](image-20260619145132762.png)

![image-20260619145215571](image-20260619145215571.png)

![image-20260619145246414](image-20260619145246414.png)

![image-20260619145326455](image-20260619145326455.png)

![image-20260619145410323](image-20260619145410323.png)

![image-20260619145506319](image-20260619145506319.png)

接下来可以：

| 功能                       | 命令语句                                     |
| -------------------------- | -------------------------------------------- |
| 打开 UI 模式（可视化调试） | `npx playwright test --ui`                   |
| 运行示例测试               | `npx playwright test`                        |
| 生成新测试                 | `npx playwright codegen https://example.com` |
| 查看测试报告               | `npx playwright show-report`                 |

### 一些github上的现成skill

[⭐2.8k](https://github.com/lackeyjb/playwright-skill)（不过还是推荐写自己的定制化skill，别人的可能用不习惯）

## 本地CLI+MCP

 Playwright 的 MCP 服务器，让 Claude 可以直接调用浏览器自动化功能，包括：

1. 打开网页：打开 https://example.com 并截图
2. 抓取内容：获取这个页面的所有标题
3. 自动化测试：帮我写一个登录测试并运行
4. 截图验证：验证这个页面是否正确渲染
5. 生成测试代码：记录我在页面上的操作并生成测试代码

### 安装Playwright MCP

首先在终端安装MCP到电脑上：`npx @playwright/mcp@latest`

然后把MCP安装在Cli（[参考文档](https://github.com/microsoft/playwright-mcp)）：`claude mcp add playwright npx @playwright/mcp@latest`

### 之前学selenium的有福了

![217218a46f54f174ea59fcec0e58be11](217218a46f54f174ea59fcec0e58be11.png)

![9dce66425daa08bde43a239fe81fefd5](9dce66425daa08bde43a239fe81fefd5.png)



