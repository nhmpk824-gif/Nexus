<p align="center">
  <img src="../public/nexus-256.png" alt="Nexus" width="96" />
</p>

<h1 align="center">Nexus Lite</h1>

<p align="center">
  跨平台桌面 AI 陪伴应用 · 精简版
</p>

<p align="center">
  <a href="../README.md">English</a> · <b>简体中文</b> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

---

## 简介

Nexus Lite 是一款跨平台的桌面 AI 陪伴应用，集成 Live2D 角色渲染、连续语音对话、长期记忆、桌面感知与自主行为能力。这是聚焦于核心陪伴体验的精简版本。

---

## 核心功能

- **桌宠 + 面板** 双视图，Live2D 角色渲染与表情/动作/情绪联动
- **连续语音对话** — 多引擎 STT（Sherpa、SenseVoice、FunASR、腾讯 ASR、浏览器识别）与 TTS（Edge TTS、MiniMax、火山引擎、CosyVoice2、本地 Sherpa TTS），支持唤醒词、VAD 语音活动检测、连续对话、语音打断
- **事件总线架构** — VoiceBus 统一管理语音生命周期（STT/TTS/会话），纯 reducer + effect 模式驱动状态流转
- **长期记忆** — 语义向量检索、每日自动日记、主动召回、记忆归档与整理
- **桌面感知** — 剪贴板监听、前台窗口识别、截图 OCR
- **自主行为** — 上下文调度、焦点感知、记忆整理（dream）、主动触发引擎
- **工具调用** — 网页搜索、天气查询、提醒任务、MCP 协议接入
- **多语言** — 简中/繁中/英/日/韩 界面语言

---

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Electron 33 |
| 前端 | React 19 · TypeScript · Vite 6 |
| 角色 | PixiJS · pixi-live2d-display |
| 语音输入 | Sherpa-onnx · SenseVoice · FunASR · 腾讯 ASR · Web Speech API |
| 语音输出 | Edge TTS · MiniMax · 火山引擎 · CosyVoice2 · Sherpa TTS · 系统语音 |
| 本地 ML | onnxruntime-web · @huggingface/transformers |
| 打包 | electron-builder |

---

## 快速开始

**环境要求**：Windows / macOS / Linux · Node.js 20+ · npm 10+

```bash
npm install
npm run electron:dev    # 开发模式
npm run build           # 构建
npm run package:win     # 打包 Windows 安装程序
npm run package:mac     # 打包 macOS 安装程序
npm run package:linux   # 打包 Linux 安装程序
```

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | Vite 开发服务器 |
| `npm run electron:dev` | Electron 联调 |
| `npm run build` | 构建前端 |
| `npm test` | 运行测试 |
| `npm run package:win` | 生成安装包 |

---

## 许可证

[MIT](../LICENSE)
