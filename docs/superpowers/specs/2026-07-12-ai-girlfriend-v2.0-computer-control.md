# AI 女友 v2.0 — 电脑操作能力

**日期**: 2026-07-12  
**状态**: 已确认  
**依赖**: Electron 桌面应用底座

---

## 1. 概述

让 AI 女友具备 Agent 级电脑操控能力：通过 DeepSeek Function Calling 自动识别用户意图，调用电脑工具执行操作，用聊天口吻反馈结果。

## 2. 通信架构

```
聊天界面 (renderer)
    → ai.js 调 DeepSeek API (带 tools 声明)
    → DeepSeek 返回 tool_calls
    → 确认弹窗
    → preload.js (ipcRenderer.invoke)
    → main.js (Node.js 执行)
    → 结果返回 → 再调 DeepSeek → 自然语言回复
```

## 3. 工具列表

### 文件操作
- `search_files(query)` — 按文件名搜索
- `read_file(path)` — 读取文件内容
- `write_file(path, content)` — 创建/修改文件
- `list_dir(path)` — 列出目录内容

### 系统操作
- `open_app(name)` — 打开应用程序
- `run_command(cmd)` — 执行终端命令（白名单制）
- `screenshot()` — 截取屏幕

## 4. 安全设计

- 每次工具调用弹确认窗，仅有 [拒绝] [允许] 按钮，无超时
- 支持"从此信任此类操作"
- `run_command` 每次必确认，无信任选项
- 危险命令黑名单（rm -rf, format, del /f 等）直接拒绝
- 文件写入限制在用户目录
- 所有操作记录日志到 `~/.ai-girlfriend/operations.log`

## 5. 修改的文件

| 文件 | 改动 |
|------|------|
| `main.js` | 增加 IPC handlers + Node.js 工具实现 |
| `preload.js` | 暴露安全 API |
| `js/ai.js` | 支持 Function Calling + tools 声明 + tool_calls 处理 |
| `js/chat.js` | 确认弹窗逻辑 + tool_calls 循环 |

## 6. 全局约束

- 纯本地，无云端依赖（除 DeepSeek API）
- API Key 仅存 localStorage
- 无超时拒绝机制
