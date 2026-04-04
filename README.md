<p align="center">
  <img src="public/icon.png" alt="Nexus" width="96" />
</p>

<h1 align="center">Nexus</h1>

<p align="center">
  Windows 桌面 AI 陪伴体 · Desktop AI Companion
</p>

<p align="center">
  <a href="#简体中文">简体中文</a> · <a href="#繁體中文">繁體中文</a> · <a href="#english">English</a> · <a href="#日本語">日本語</a> · <a href="#한국어">한국어</a>
</p>

---

<a id="简体中文"></a>

## 简体中文

### 简介

Nexus 是一个面向 Windows 的桌面 AI 陪伴应用，集成 Live2D 角色渲染、语音交互、长期记忆与桌面感知能力。

### 核心功能

- **桌宠 + 面板** 双视图，Live2D 角色渲染与表情/动作联动
- **语音交互** — 本地/云端 STT 与 TTS，支持唤醒词、VAD、连续语音
- **长期记忆** — 语义检索、每日日记、自动召回
- **桌面感知** — 剪贴板、前台窗口、截图 OCR
- **工具调用** — 网页搜索、天气、提醒任务、MCP 协议接入
- **多语言** — 简中/繁中/英/日/韩 界面语言

### 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Electron |
| 前端 | React 19 · TypeScript · Vite |
| 角色 | PixiJS · pixi-live2d-display |
| 语音 | Sherpa-onnx · Edge TTS · MiniMax · 火山引擎 |
| 本地 ML | onnxruntime-web · @huggingface/transformers |
| 打包 | electron-builder |

### 快速开始

环境要求：Windows 10/11、Node.js 20+、npm 10+

```bash
npm install
npm run electron:dev    # 开发模式
npm run build           # 构建
npm run package:win     # 打包 Windows 安装程序
```

### 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | Vite 开发服务器 |
| `npm run electron:dev` | Electron 联调 |
| `npm run build` | 构建前端 |
| `npm test` | 运行测试 |
| `npm run package:win` | 生成安装包 |

### 项目结构

```
electron/          桌面运行时与原生桥接
src/app/           应用组装、控制器、视图
src/components/    共享 UI 组件
src/features/      领域模块（语音、记忆、工具、角色…）
src/hooks/         React 编排 Hook
src/i18n/          多语言
src/lib/           纯工具函数与提供者注册表
src/types/         类型定义
tests/             测试
```

---

<a id="繁體中文"></a>

## 繁體中文

### 簡介

Nexus 是一個面向 Windows 的桌面 AI 陪伴應用，整合 Live2D 角色渲染、語音互動、長期記憶與桌面感知能力。

### 核心功能

- **桌寵 + 面板** 雙視圖，Live2D 角色渲染與表情/動作聯動
- **語音互動** — 本地/雲端 STT 與 TTS，支援喚醒詞、VAD、連續語音
- **長期記憶** — 語義檢索、每日日記、自動召回
- **桌面感知** — 剪貼簿、前台視窗、截圖 OCR
- **工具調用** — 網頁搜尋、天氣、提醒任務、MCP 協議接入
- **多語言** — 簡中/繁中/英/日/韓 介面語言

### 快速開始

```bash
npm install
npm run electron:dev    # 開發模式
npm run build           # 建置
npm run package:win     # 打包 Windows 安裝程式
```

---

<a id="english"></a>

## English

### Overview

Nexus is a Windows desktop AI companion app featuring Live2D character rendering, voice interaction, long-term memory, and desktop awareness.

### Features

- **Pet + Panel** dual-view with Live2D character expressions and motion
- **Voice** — local/cloud STT & TTS, wake word, VAD, continuous mode
- **Memory** — semantic retrieval, daily diary, automatic recall
- **Desktop awareness** — clipboard, foreground window, screenshot OCR
- **Tools** — web search, weather, reminders, MCP protocol integration
- **Multilingual** — Simplified Chinese / Traditional Chinese / English / Japanese / Korean

### Quick Start

Requirements: Windows 10/11, Node.js 20+, npm 10+

```bash
npm install
npm run electron:dev    # dev mode
npm run build           # build
npm run package:win     # package Windows installer
```

---

<a id="日本語"></a>

## 日本語

### 概要

Nexus は Windows 向けのデスクトップ AI コンパニオンアプリです。Live2D キャラクターレンダリング、音声インタラクション、長期記憶、デスクトップ認識機能を備えています。

### 主な機能

- **ペット + パネル** のデュアルビュー、Live2D キャラクターの表情・モーション連動
- **音声対話** — ローカル/クラウド STT・TTS、ウェイクワード、VAD、連続音声
- **長期記憶** — セマンティック検索、デイリー日記、自動リコール
- **デスクトップ認識** — クリップボード、前面ウィンドウ、スクリーンショット OCR
- **ツール連携** — Web 検索、天気、リマインダー、MCP プロトコル
- **多言語** — 簡体字中国語 / 繁体字中国語 / 英語 / 日本語 / 韓国語

### クイックスタート

```bash
npm install
npm run electron:dev    # 開発モード
npm run build           # ビルド
npm run package:win     # Windows インストーラーのパッケージング
```

---

<a id="한국어"></a>

## 한국어

### 개요

Nexus는 Windows용 데스크톱 AI 컴패니언 앱입니다. Live2D 캐릭터 렌더링, 음성 상호작용, 장기 기억, 데스크톱 인식 기능을 갖추고 있습니다.

### 주요 기능

- **펫 + 패널** 듀얼 뷰, Live2D 캐릭터 표정/모션 연동
- **음성 대화** — 로컬/클라우드 STT·TTS, 웨이크워드, VAD, 연속 음성
- **장기 기억** — 시맨틱 검색, 데일리 다이어리, 자동 리콜
- **데스크톱 인식** — 클립보드, 포그라운드 윈도우, 스크린샷 OCR
- **도구 연동** — 웹 검색, 날씨, 리마인더, MCP 프로토콜
- **다국어** — 간체/번체 중국어 / 영어 / 일본어 / 한국어

### 빠른 시작

```bash
npm install
npm run electron:dev    # 개발 모드
npm run build           # 빌드
npm run package:win     # Windows 설치 프로그램 패키징
```

---

## License

MIT
