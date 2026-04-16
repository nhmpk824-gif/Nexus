<p align="center"><img src="public/banner.png" alt="Nexus" width="720" /></p>

<h1 align="center">Nexus</h1>

<h3 align="center">A desktop AI companion that remembers, dreams, and lives on your screen.</h3>

<p align="center">
  <a href="https://github.com/FanyinLiu/Nexus/releases/latest"><img src="https://img.shields.io/github/v/release/FanyinLiu/Nexus?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/FanyinLiu/Nexus/blob/main/LICENSE"><img src="https://img.shields.io/github/license/FanyinLiu/Nexus?style=flat-square" alt="License"></a>
  <a href="https://github.com/FanyinLiu/Nexus/stargazers"><img src="https://img.shields.io/github/stars/FanyinLiu/Nexus?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/FanyinLiu/Nexus"><img src="https://img.shields.io/github/last-commit/FanyinLiu/Nexus?style=flat-square" alt="Last Commit"></a>
</p>

<p align="center">
  <b>English</b> · <a href="docs/README.zh-CN.md">简体中文</a> · <a href="docs/README.zh-TW.md">繁體中文</a> · <a href="docs/README.ja.md">日本語</a>
</p>

---

> **Note**: Nexus is under active development. Some features are stable, some are still being polished. Feedback and contributions are welcome!

## What is Nexus?

Nexus is a cross-platform desktop companion powered by LLMs. It pairs a Live2D character with voice conversation, long-term memory, desktop awareness, autonomous behavior, and tool calling — designed to feel less like a chatbot and more like someone who actually knows you.

Built with Electron + React + TypeScript. Runs on Windows, macOS, and Linux. Supports 18+ LLM providers, works fully offline or with cloud models.

---

## Features

- 🎙️ **Always-on wake word** — Say the wake word and start talking, no button needed. Powered by sherpa-onnx keyword spotter with main-process Silero VAD sharing a single mic stream.

- 🗣️ **Continuous voice chat** — Multi-engine STT / TTS, echo-cancelled self-interrupt (never wakes itself up while talking), sentence-immediate streaming TTS (first audio at the first comma).

- 🧠 **Memory that dreams** — Three-tier hot / warm / cold memory with hybrid BM25 + vector search. A nightly *dream cycle* clusters your conversations into *narrative threads*, so the companion actually builds a picture of who you are over time.

- 🤖 **Autonomous inner life** — Inner monologue, emotion model, relationship tracking, rhythm learning, intent prediction, and skill distillation. It thinks while you're away and greets you when you come back.

- 🔧 **Tool calling (MCP)** — Web search, weather, reminders, and any MCP-compatible tool. Works with native function calling **and** a prompt-mode fallback for models that don't support `tools`.

- 🔄 **Provider failover** — Chain multiple LLM / STT / TTS providers. When one goes down, Nexus switches to the next without interrupting the conversation.

- 🖥️ **Desktop awareness** — Reads your clipboard, foreground window title, and (optionally) screen OCR. Context triggers let it react to what you're doing.

- 🔔 **Notification bridge** — Local webhook server + RSS polling. Push external notifications into the companion conversation.

- 💬 **Multi-platform** — Discord and Telegram gateways with per-chat routing. Talk to your companion from your phone.

- 🌐 **Multilingual** — UI in Simplified Chinese, Traditional Chinese, English, Japanese, and Korean.

---

## Supported Providers

| Category | Providers |
|----------|-----------|
| **LLM (18+)** | OpenAI · Anthropic · Gemini · DeepSeek · Kimi · Qwen · GLM · Grok · MiniMax · SiliconFlow · OpenRouter · Together · Mistral · Qianfan · Z.ai · BytePlus · NVIDIA · Venice · Ollama · Custom |
| **STT** | GLM-ASR-Nano · Paraformer · SenseVoice · Zhipu GLM-ASR · Volcengine · OpenAI Whisper · ElevenLabs Scribe · Tencent ASR · Custom |
| **TTS** | Edge TTS · MiniMax · Volcengine · DashScope Qwen3-TTS · OmniVoice · OpenAI TTS · ElevenLabs · Custom |
| **Web Search** | DuckDuckGo · Bing · Brave · Tavily · Exa · Firecrawl · Gemini Grounding · Perplexity |

---

## Quick Start

**Requirements**: Node.js 22+ · npm 10+

```bash
git clone https://github.com/FanyinLiu/Nexus.git
cd Nexus
npm install
npm run electron:dev
```

To build and package:

```bash
npm run build
npm run package:win     # or package:mac / package:linux
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 36 |
| Frontend | React 19 · TypeScript · Vite 8 |
| Character | PixiJS · pixi-live2d-display |
| Local ML | sherpa-onnx-node · onnxruntime-web · @huggingface/transformers |
| Packaging | electron-builder |

---

## Contributing

Contributions are welcome! Whether it's bug fixes, new features, translations, or documentation — feel free to open a PR or start a discussion in Issues.

---

## Star History

<a href="https://star-history.com/#FanyinLiu/Nexus&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date" />
 </picture>
</a>

---

## License

[MIT](LICENSE)
