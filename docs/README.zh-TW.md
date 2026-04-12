<p align="center">
  <img src="../public/nexus-256.png" alt="Nexus" width="96" />
</p>

<h1 align="center">Nexus Lite</h1>

<p align="center">
  跨平台桌面 AI 陪伴應用 · 精簡版
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>繁體中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

---

## 簡介

Nexus Lite 是一款跨平台的桌面 AI 陪伴應用，整合 Live2D 角色渲染、連續語音對話、長期記憶、桌面感知與自主行為能力。這是聚焦於核心陪伴體驗的精簡版本。

---

## 核心功能

- **桌寵 + 面板** 雙視圖，Live2D 角色渲染與表情/動作/情緒聯動
- **連續語音對話** — 多引擎 STT（Sherpa、SenseVoice、FunASR、騰訊 ASR、瀏覽器識別）與 TTS（Edge TTS、MiniMax、火山引擎、CosyVoice2、本地 Sherpa TTS），支援喚醒詞、VAD、連續對話、語音打斷
- **事件匯流排架構** — VoiceBus 統一管理語音生命週期，純 reducer + effect 模式驅動狀態流轉
- **長期記憶** — 語義向量檢索、每日自動日記、主動召回、記憶歸檔
- **桌面感知** — 剪貼簿監聽、前台視窗識別、截圖 OCR
- **自主行為** — 上下文排程、焦點感知、記憶整理、主動觸發引擎
- **工具調用** — 網頁搜尋、天氣、提醒任務、MCP 協議接入
- **多語言** — 簡中/繁中/英/日/韓 介面語言

---

## 快速開始

**環境需求**：Windows / macOS / Linux · Node.js 20+ · npm 10+

```bash
npm install
npm run electron:dev    # 開發模式
npm run build           # 建置
npm run package:win     # 打包 Windows 安裝程式
npm run package:mac     # 打包 macOS 安裝程式
npm run package:linux   # 打包 Linux 安裝程式
```

---

## 授權條款

[MIT](../LICENSE)
