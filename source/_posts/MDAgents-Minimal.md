---
title: MDAgents-Minimal
date: 2026-10-15 01:15:59
tags:
research: project
research_order: 0
cover: https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBtqtqz7mT7oV8jjPvLHCxA37tM2gyRQACvwxrG8aFgEbORKFXikHrewEAAwIAA3kAAz0E.png
cover_fit: contain
---

# 系统总览

![image-20261015012013762](MDAgents-Minimal/image-20261015012013762.png)

一共三个py文件

# main

## 函数体外

![image-20261015013141196](MDAgents-Minimal/image-20261015013141196.png)

保证所有通过 `print()` 输出到终端的内容，会尽量使用 UTF-8 编码。

##  parse_args

![image-20261015014328775](MDAgents-Minimal/image-20261015014328775.png)

`add_argument`所用到的形参

| 形参      | 作用                                              |
| --------- | ------------------------------------------------- |
| `*args`   | 定义选项名或位置参数名，比如 `"-h"`、`"--prompt"` |
| `action`  | 决定参数被解析时执行什么动作                      |
| `type`    | 把命令行字符串转换成其他类型，例如 `int`          |
| `default` | 用户没有提供该参数时使用的值                      |
| `choices` | 限定参数只能取哪些值                              |
| `help`    | 在 `--help` 帮助信息中显示的文字                  |

## print_result
