<p align="center">
  <img src="public/nexus-256.png" alt="Nexus" width="96" />
</p>

<h1 align="center">Nexus Lite</h1>

<p align="center">
  Cross-platform desktop AI companion · Lite Edition
</p>

<p align="center">
  <a href="https://github.com/FanyinLiu/nexus-lite/blob/main/LICENSE"><img src="https://img.shields.io/github/license/FanyinLiu/nexus-lite?style=flat-square" alt="License"></a>
  <a href="https://github.com/FanyinLiu/nexus-lite/stargazers"><img src="https://img.shields.io/github/stars/FanyinLiu/nexus-lite?style=flat-square" alt="Stars"></a>
</p>

<p align="center">
  <b>English</b> · <a href="docs/README.zh-CN.md">简体中文</a> · <a href="docs/README.zh-TW.md">繁體中文</a> · <a href="docs/README.ja.md">日本語</a> · <a href="docs/README.ko.md">한국어</a>
</p>

---

## Overview

Nexus Lite is a cross-platform desktop AI companion featuring Live2D character rendering, continuous voice conversation, long-term memory, desktop awareness, and autonomous behavior. It is the lightweight edition focused on the core companion experience.

---

## Features

- **Pet + Panel** dual-view with Live2D character expressions, motion, and mood
- **Voice interaction** — multi-engine STT (Sherpa, SenseVoice, FunASR, Tencent ASR, Web Speech API) & TTS (Edge TTS, MiniMax, Volcengine, CosyVoice2, local Sherpa TTS); wake word, VAD, continuous conversation, speech interruption
- **Event bus architecture** — VoiceBus manages voice lifecycle (STT/TTS/session) with a pure reducer + effect pattern
- **Long-term memory** — semantic vector search, auto daily diary, proactive recall, archive
- **Desktop awareness** — clipboard, foreground window, screenshot OCR
- **Autonomous behavior** — context scheduling, focus awareness, memory consolidation, proactive engine
- **Tool calling** — web search, weather, reminders, MCP protocol
- **Multilingual** — Simplified Chinese / Traditional Chinese / English / Japanese / Korean

---

## Architecture

```
                        ┌──────────────────────────┐
                        │     Electron Main        │
                        │  IPC · TTS · ASR · MCP   │
                        └────────────┬─────────────┘
                                     │
                        ┌────────────▼─────────────┐
                        │     React Frontend       │
                        ├──────────────────────────┤
                        │  useAppController        │
                        │    ├─ useVoice           │
                        │    │   └─ VoiceBus       │
                        │    ├─ useChat            │
                        │    ├─ useMemory          │
                        │    └─ usePetBehavior     │
                        ├──────────────────────────┤
                        │  features/               │
                        │    ├─ voice (bus/reducer) │
                        │    ├─ hearing (STT)      │
                        │    ├─ memory (vector)    │
                        │    ├─ autonomy (tick)    │
                        │    ├─ chat (runtime)     │
                        │    └─ harness (eval)     │
                        └──────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 33 |
| Frontend | React 19 · TypeScript · Vite 6 |
| Character | PixiJS · pixi-live2d-display |
| STT | Sherpa-onnx · SenseVoice · FunASR · Tencent ASR · Web Speech API |
| TTS | Edge TTS · MiniMax · Volcengine · CosyVoice2 · Sherpa TTS · System voice |
| Local ML | onnxruntime-web · @huggingface/transformers |
| Packaging | electron-builder |

---

## Quick Start

**Requirements**: Windows / macOS / Linux · Node.js 20+ · npm 10+

```bash
npm install
npm run electron:dev    # dev mode
npm run build           # build
npm run package:win     # package Windows installer
npm run package:mac     # package macOS installer
npm run package:linux   # package Linux installer
```

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run electron:dev` | Electron dev mode |
| `npm run build` | Build frontend |
| `npm test` | Run tests |
| `npm run package:win` | Package Windows installer |

---

## Project Structure

```
electron/              Desktop runtime & native bridge
  ipc/                 IPC channel modules (audio/chat/memory/tts…)
  services/            Backend services (TTS, vector store, Tencent ASR…)
src/
  app/                 App assembly, controllers, views
    controllers/       useAppController · useAutonomyController
    store/             Settings persistence
  components/          Shared UI components
    settingsSections/  Settings panel sections
  features/            Domain modules
    voice/             VoiceBus event bus · session state machine · streaming playback
    hearing/           STT engine adapters (Sherpa/SenseVoice/FunASR/Tencent)
    memory/            Semantic memory · vector search · archive · recall
    autonomy/          Autonomous behavior (context scheduling/focus awareness/memory consolidation)
    chat/              LLM runtime
    harness/           Execution constraints · evaluation · convergence
    pet/               Character behavior · expression control
  hooks/               React orchestration hooks
    voice/             Voice session lifecycle · STT transcript handling · TTS playback · continuous conversation
    chat/              Assistant replies · reminders · stream abort
  i18n/                Multilingual (zh-CN/zh-TW/en/ja/ko)
  lib/                 Pure utilities & provider registry
  types/               Type definitions
tests/                 Tests
```

---

## License

[MIT](LICENSE)
