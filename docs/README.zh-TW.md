<p align="center"><img src="../public/banner.png" alt="Nexus" width="720" /></p>

<h1 align="center">Nexus</h1>

<h3 align="center">一個住在你桌面上的 AI 夥伴——會記憶、會做夢、會陪伴。</h3>

<p align="center">
  <a href="https://github.com/FanyinLiu/Nexus/releases/latest"><img src="https://img.shields.io/github/v/release/FanyinLiu/Nexus?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/FanyinLiu/Nexus/blob/main/LICENSE"><img src="https://img.shields.io/github/license/FanyinLiu/Nexus?style=flat-square" alt="License"></a>
  <a href="https://github.com/FanyinLiu/Nexus/stargazers"><img src="https://img.shields.io/github/stars/FanyinLiu/Nexus?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/FanyinLiu/Nexus"><img src="https://img.shields.io/github/last-commit/FanyinLiu/Nexus?style=flat-square" alt="Last Commit"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>繁體中文</b> · <a href="README.ja.md">日本語</a>
</p>

---

> **注意**：Nexus 正在積極開發中。部分功能已經穩定，部分仍在打磨。歡迎回饋與貢獻！

## Nexus 是什麼？

Nexus 是一個跨平台的桌面 AI 夥伴，基於大型語言模型驅動。它將 Live2D 角色與語音對話、長期記憶、桌面感知、自主行為和工具呼叫相結合——設計目標不是做一個聊天機器人，而是一個真正了解你的夥伴。

使用 Electron + React + TypeScript 建構，支援 Windows、macOS 和 Linux。內建 18+ LLM 供應商，可完全離線運行或使用雲端模型。

<!-- TODO: Add demo screenshots here
### 展示

| ![](docs/assets/demo-1.png) | ![](docs/assets/demo-2.png) |
|:---:|:---:|
| 桌寵模式 | 聊天面板 |
-->

---

## 功能特色

- 🎙️ **常駐喚醒詞** — 說出喚醒詞即可開始對話，無需按鍵。基於 sherpa-onnx 關鍵詞偵測，主行程 Silero VAD 共享單路麥克風流。

- 🗣️ **連續語音對話** — 多引擎 STT / TTS，回聲消除自動打斷（說話時不會被自己的聲音喚醒），句級串流 TTS（第一個逗號就開始播報）。

- 🧠 **會做夢的記憶** — 熱 / 溫 / 冷三級記憶架構，BM25 + 向量混合檢索。每晚執行*夢境循環*，將對話聚類成*敘事線索*，讓夥伴逐漸建立對你的完整認知。

- 🤖 **自主內在生活** — 內心獨白、情緒模型、關係追蹤、節律學習、意圖預測、技能蒸餾。你不在時它會思考，你回來時它會主動問候。

- 🔧 **工具呼叫 (MCP)** — 網頁搜尋、天氣查詢、提醒任務及任何 MCP 相容工具。支援原生函式呼叫，同時為不支援 `tools` 的模型提供提示詞模式回退。

- 🔄 **供應商故障轉移** — 可串聯多個 LLM / STT / TTS 供應商。當某個供應商停機時，Nexus 自動切換到下一個，對話不中斷。

- 🖥️ **桌面感知** — 讀取剪貼簿、前台視窗標題，以及（可選的）螢幕 OCR。上下文觸發器讓它能對你正在做的事情作出反應。

- 🔔 **通知橋接** — 本地 Webhook 伺服器 + RSS 輪詢。將外部通知推送到夥伴的對話中。

- 💬 **多平台** — Discord 和 Telegram 閘道，支援按聊天路由。在手機上也能和夥伴對話。

- 🌐 **多語言** — 介面支援簡體中文、繁體中文、英語、日語和韓語。

---

## 支援的供應商

| 類別 | 供應商 |
|------|--------|
| **LLM (18+)** | OpenAI · Anthropic · Gemini · DeepSeek · Kimi · Qwen · GLM · Grok · MiniMax · SiliconFlow · OpenRouter · Together · Mistral · Qianfan · Z.ai · BytePlus · NVIDIA · Venice · Ollama · Custom |
| **STT** | GLM-ASR-Nano · Paraformer · SenseVoice · Zhipu GLM-ASR · Volcengine · OpenAI Whisper · ElevenLabs Scribe · Tencent ASR · Custom |
| **TTS** | Edge TTS · MiniMax · Volcengine · DashScope Qwen3-TTS · OmniVoice · OpenAI TTS · ElevenLabs · Custom |
| **網頁搜尋** | DuckDuckGo · Bing · Brave · Tavily · Exa · Firecrawl · Gemini Grounding · Perplexity |

---

## 推薦模型配置

> 此推薦針對**繁體中文使用者**。其他語言請查看 [English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)。

### 對話模型（LLM）

| 場景 | 推薦供應商 | 推薦模型 | 說明 |
|------|-----------|---------|------|
| **日常陪伴（首選）** | DeepSeek | `deepseek-chat` | 中文能力強、價格極低，適合長時間陪伴對話 |
| **日常陪伴（備選）** | DashScope Qwen | `qwen-plus` | 阿里通義千問，中文自然，長上下文支援良好 |
| **深度推理** | DeepSeek | `deepseek-reasoner` | 需要複雜推理、數學、程式碼時使用 |
| **最強綜合** | Anthropic | `claude-sonnet-4-6` | 綜合能力最強，工具呼叫穩定 |
| **高性價比（海外）** | OpenAI | `gpt-5.4-mini` | 速度快、便宜，適合高頻對話 |
| **免費體驗** | Google Gemini | `gemini-2.5-flash` | 免費額度大，適合入門體驗 |

### 語音輸入（STT）

| 場景 | 推薦供應商 | 推薦模型 | 說明 |
|------|-----------|---------|------|
| **本地高精度** | GLM-ASR-Nano | `glm-asr-nano` | 中文識別準確率高，RTX 3060 可流暢運行，完全離線 |
| **本地串流** | Paraformer | `paraformer-trilingual` | 邊說邊出字，延遲低，中英粵三語，適合連續對話 |
| **本地備選** | SenseVoice | `sensevoice-zh-en` | 比 Whisper 快 15 倍，中英雙語離線識別 |
| **雲端首選** | 智譜 GLM-ASR | `glm-asr-2512` | 中文最佳，支援熱詞糾正 |
| **雲端備選** | 火山引擎 | `bigmodel` | 位元組跳動大模型語音識別，中文優秀 |
| **雲端備選** | 騰訊雲 ASR | `16k_zh` | 即時串流識別，延遲低 |

### 語音輸出（TTS）

| 場景 | 推薦供應商 | 推薦音色 | 說明 |
|------|-----------|---------|------|
| **免費首選** | Edge TTS | 曉臻 (`zh-TW-HsiaoChenNeural`) | 微軟免費，台灣腔自然，無需 API Key |
| **免費備選** | Edge TTS | 雲哲 (`zh-TW-YunJheNeural`) | 男聲，台灣腔，免費 |
| **本地離線** | OmniVoice | 內建音色 | 完全離線，本地連接埠 8000，RTX 3060 可運行 |
| **最自然** | MiniMax | 少女音色 (`female-shaonv`) | 情感表現力強，適合陪伴角色 |
| **中文指令化** | DashScope Qwen-TTS | `Cherry` | 阿里 Qwen3-TTS，支援方言和指令化播報 |

---

## 快速開始

**前置需求**：Node.js 22+ · npm 10+

```bash
git clone https://github.com/FanyinLiu/Nexus.git
cd Nexus
npm install
npm run electron:dev
```

建構和打包：

```bash
npm run build
npm run package:win     # 或 package:mac / package:linux
```

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 執行環境 | Electron 36 |
| 前端 | React 19 · TypeScript · Vite 8 |
| 角色渲染 | PixiJS · pixi-live2d-display |
| 本地 ML | sherpa-onnx-node · onnxruntime-web · @huggingface/transformers |
| 打包 | electron-builder |

---

## 參與貢獻

歡迎各種形式的貢獻！無論是修復 Bug、新增功能、翻譯還是文件——請隨時提交 PR 或在 Issues 中發起討論。

---

## Star 趨勢

<a href="https://star-history.com/#FanyinLiu/Nexus&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date" />
 </picture>
</a>

---

## 授權條款

[MIT](../LICENSE)
