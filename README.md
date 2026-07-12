# 小七 💕

桌面 AI 女友应用。Electron + DeepSeek，数据完全保存在本地。

## 功能

- 💬 **聊天对话** — 通过 DeepSeek API 驱动的 AI 女友
- 🎭 **性格模板** — 内置傲娇毒舌模板，支持自定义
- 🧠 **记忆系统** — 手动填写 + 自动从对话中学习
- 🌅 **时间问候** — 打开网页时根据时间主动问候
- 🔔 **通知提醒** — 可选的浏览器定时提醒

## 使用方法

1. 在 [DeepSeek Platform](https://platform.deepseek.com) 获取 API Key
2. 打开网页，填写 API Key 和你的昵称
3. 开始聊天！

## 运行方式

### 桌面应用（推荐）

```bash
npm install
npm start
```

### 浏览器打开

直接用浏览器打开 `index.html` 即可（ES Modules 需通过 HTTP 服务器访问，如 `npx serve .`）。

## 打包

```bash
npm run build          # 便携版 exe
npm run build:installer  # 安装包
```

打包输出在 `dist/` 目录。

## 技术栈

- 纯 HTML + CSS + Vanilla JS (ES Modules)
- DeepSeek API (OpenAI 兼容格式)
- IndexedDB 本地存储
- 无框架、无构建工具、无后端

## 隐私

所有数据（聊天记录、记忆、设置）仅保存在你的浏览器 IndexedDB 中。
API Key 仅保存在 localStorage，不会上传到任何第三方服务器。
