<p align="center"><img src="../public/banner.png" alt="Nexus" width="720" /></p>

<h1 align="center">Nexus</h1>

<h3 align="center">あなたのデスクトップに住む AI コンパニオン——記憶し、夢を見て、寄り添います。</h3>

<p align="center">
  <a href="https://github.com/FanyinLiu/Nexus/releases/latest"><img src="https://img.shields.io/github/v/release/FanyinLiu/Nexus?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/FanyinLiu/Nexus/blob/main/LICENSE"><img src="https://img.shields.io/github/license/FanyinLiu/Nexus?style=flat-square" alt="License"></a>
  <a href="https://github.com/FanyinLiu/Nexus/stargazers"><img src="https://img.shields.io/github/stars/FanyinLiu/Nexus?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/FanyinLiu/Nexus"><img src="https://img.shields.io/github/last-commit/FanyinLiu/Nexus?style=flat-square" alt="Last Commit"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <b>日本語</b>
</p>

---

> **注意**：Nexus は活発に開発中です。一部の機能は安定していますが、まだ磨き上げ中のものもあります。フィードバックやコントリビューションを歓迎します！

## Nexus とは？

Nexus は LLM を搭載したクロスプラットフォームのデスクトップ AI コンパニオンです。Live2D キャラクターに音声会話、長期記憶、デスクトップ認識、自律行動、ツール呼び出しを組み合わせ——チャットボットではなく、あなたを本当に理解してくれる存在を目指して設計されています。

Electron + React + TypeScript で構築。Windows、macOS、Linux に対応。18 以上の LLM プロバイダーを内蔵し、完全オフラインまたはクラウドモデルで動作します。

<!-- TODO: Add demo screenshots here
### デモ

| ![](docs/assets/demo-1.png) | ![](docs/assets/demo-2.png) |
|:---:|:---:|
| ペットモード | チャットパネル |
-->

---

## 機能

- 🎙️ **常時ウェイクワード** — ウェイクワードを言うだけで会話開始、ボタン不要。sherpa-onnx キーワードスポッターを使用し、メインプロセスの Silero VAD で単一マイクストリームを共有。

- 🗣️ **連続音声チャット** — マルチエンジン STT / TTS、エコーキャンセル付き自動割り込み（自分の声で起きることがない）、文単位のストリーミング TTS（最初のカンマで音声再生開始）。

- 🧠 **夢を見る記憶** — ホット / ウォーム / コールドの三層記憶アーキテクチャ、BM25 + ベクトルのハイブリッド検索。毎晩の*ドリームサイクル*が会話を*ナラティブスレッド*にクラスタリングし、コンパニオンがあなたの全体像を徐々に構築。

- 🤖 **自律的な内面生活** — 内面独白、感情モデル、関係追跡、リズム学習、意図予測、スキル蒸留。あなたがいない間も考え、戻ってきたら自分から挨拶。

- 🔧 **ツール呼び出し (MCP)** — ウェブ検索、天気、リマインダー、あらゆる MCP 互換ツール。ネイティブ関数呼び出しに対応し、`tools` をサポートしないモデル向けにプロンプトモードのフォールバックも搭載。

- 🔄 **プロバイダーフェイルオーバー** — 複数の LLM / STT / TTS プロバイダーをチェーン接続。1つがダウンしても、会話を中断せず次に切り替え。

- 🖥️ **デスクトップ認識** — クリップボード、フォアグラウンドウィンドウタイトル、（オプションで）スクリーン OCR を読み取り。コンテキストトリガーにより、あなたの操作に反応。

- 🔔 **通知ブリッジ** — ローカル Webhook サーバー + RSS ポーリング。外部通知をコンパニオンの会話にプッシュ。

- 💬 **マルチプラットフォーム** — Discord と Telegram ゲートウェイ、チャットごとのルーティング対応。スマートフォンからもコンパニオンと会話可能。

- 🌐 **多言語** — UI は簡体字中国語、繁体字中国語、英語、日本語、韓国語に対応。

---

## 対応プロバイダー

| カテゴリ | プロバイダー |
|----------|-------------|
| **LLM (18+)** | OpenAI · Anthropic · Gemini · DeepSeek · Kimi · Qwen · GLM · Grok · MiniMax · SiliconFlow · OpenRouter · Together · Mistral · Qianfan · Z.ai · BytePlus · NVIDIA · Venice · Ollama · Custom |
| **STT** | GLM-ASR-Nano · Paraformer · SenseVoice · Zhipu GLM-ASR · Volcengine · OpenAI Whisper · ElevenLabs Scribe · Tencent ASR · Custom |
| **TTS** | Edge TTS · MiniMax · Volcengine · DashScope Qwen3-TTS · OmniVoice · OpenAI TTS · ElevenLabs · Custom |
| **ウェブ検索** | DuckDuckGo · Bing · Brave · Tavily · Exa · Firecrawl · Gemini Grounding · Perplexity |

---

## おすすめモデル構成

> このおすすめは**日本語ユーザー向け**です。他の言語は [English](../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) をご覧ください。

### 対話モデル（LLM）

| 用途 | プロバイダー | モデル | 備考 |
|------|------------|--------|------|
| **日常コンパニオン（おすすめ）** | DeepSeek | `deepseek-chat` | コスパ最強、日本語対応も良好、長時間の会話に最適 |
| **総合最強** | Anthropic | `claude-sonnet-4-6` | 日本語の自然さとツール呼び出しの安定性が最高クラス |
| **コスパ重視** | OpenAI | `gpt-5.4-mini` | 高速・低価格、日本語表現も自然 |
| **無料枠** | Google Gemini | `gemini-2.5-flash` | 無料枠が大きく、日本語対応も良好 |
| **深い推論** | DeepSeek | `deepseek-reasoner` | 複雑な推論・数学・コードが必要な場合 |

### 音声入力（STT）

| 用途 | プロバイダー | モデル | 備考 |
|------|------------|--------|------|
| **最高精度** | OpenAI | `whisper-large-v3` | 業界標準、日本語認識精度が最高クラス |
| **コスパ重視** | OpenAI | `gpt-4o-mini-transcribe` | 多言語対応、既存の OpenAI Key で利用可能 |
| **高精度クラウド** | ElevenLabs Scribe | `scribe_v1` | 99 言語対応、日本語の句読点・話者検出も精度高 |
| **ローカルストリーミング** | Paraformer | `paraformer-trilingual` | 話しながらリアルタイム変換、低遅延 |
| **ローカル高速** | SenseVoice | `sensevoice-zh-en` | Whisper の 15 倍高速、オフライン |

### 音声出力（TTS）

| 用途 | プロバイダー | ボイス | 備考 |
|------|------------|--------|------|
| **無料おすすめ** | Edge TTS | 七海 (`ja-JP-NanamiNeural`) | Microsoft 無料、自然な日本語女性ボイス、API Key 不要 |
| **無料（男性）** | Edge TTS | 圭太 (`ja-JP-KeitaNeural`) | 落ち着いた日本語男性ボイス、無料 |
| **最高品質** | ElevenLabs | カスタム `voice_id` | 世界トップクラスの音声合成、声クローン対応 |
| **クラウド汎用** | OpenAI TTS | `nova` / `alloy` | 既存の OpenAI Key で利用、`gpt-4o-mini-tts` モデル |
| **ローカルオフライン** | OmniVoice | 内蔵ボイス | 完全オフライン、ローカルポート 8000、RTX 3060 で動作 |

---

## クイックスタート

**必要環境**：Node.js 22+ · npm 10+

```bash
git clone https://github.com/FanyinLiu/Nexus.git
cd Nexus
npm install
npm run electron:dev
```

ビルドとパッケージング：

```bash
npm run build
npm run package:win     # または package:mac / package:linux
```

---

## 技術スタック

| レイヤー | テクノロジー |
|----------|-------------|
| ランタイム | Electron 36 |
| フロントエンド | React 19 · TypeScript · Vite 8 |
| キャラクター | PixiJS · pixi-live2d-display |
| ローカル ML | sherpa-onnx-node · onnxruntime-web · @huggingface/transformers |
| パッケージング | electron-builder |

---

## コントリビューション

コントリビューションを歓迎します！バグ修正、新機能、翻訳、ドキュメントなど——お気軽に PR を送るか、Issues でディスカッションを始めてください。

---

## Star 履歴

<a href="https://star-history.com/#FanyinLiu/Nexus&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=FanyinLiu/Nexus&type=Date" />
 </picture>
</a>

---

## ライセンス

[MIT](../LICENSE)
