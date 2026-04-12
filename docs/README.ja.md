<p align="center">
  <img src="../public/nexus-256.png" alt="Nexus" width="96" />
</p>

<h1 align="center">Nexus Lite</h1>

<p align="center">
  クロスプラットフォーム デスクトップ AI コンパニオン · ライト版
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <b>日本語</b> · <a href="README.ko.md">한국어</a>
</p>

---

## 概要

Nexus Lite はクロスプラットフォーム対応のデスクトップ AI コンパニオンアプリです。Live2D キャラクターレンダリング、連続音声会話、長期記憶、デスクトップ認識、自律的行動機能を備えています。コアコンパニオン体験に特化したライト版です。

---

## 主な機能

- **ペット + パネル** のデュアルビュー、Live2D キャラクターの表情・モーション・感情連動
- **音声対話** — マルチエンジン STT（Sherpa・SenseVoice・FunASR・テンセント ASR・Web Speech API）& TTS（Edge TTS・MiniMax・火山エンジン・CosyVoice2・ローカル Sherpa TTS）、ウェイクワード・VAD・連続会話・音声割り込み対応
- **イベントバスアーキテクチャ** — VoiceBus が音声ライフサイクルを統一管理、純粋な reducer + effect パターンで状態遷移
- **長期記憶** — セマンティック検索、デイリー日記自動生成、プロアクティブリコール、アーカイブ
- **デスクトップ認識** — クリップボード、前面ウィンドウ、スクリーンショット OCR
- **自律的行動** — コンテキストスケジューリング、フォーカス認識、記憶整理、プロアクティブエンジン
- **ツール連携** — Web 検索、天気、リマインダー、MCP プロトコル
- **多言語** — 簡体字中国語 / 繁体字中国語 / 英語 / 日本語 / 韓国語

---

## クイックスタート

**動作環境**：Windows / macOS / Linux · Node.js 20+ · npm 10+

```bash
npm install
npm run electron:dev    # 開発モード
npm run build           # ビルド
npm run package:win     # Windows インストーラーのパッケージング
npm run package:mac     # macOS インストーラーのパッケージング
npm run package:linux   # Linux インストーラーのパッケージング
```

---

## ライセンス

[MIT](../LICENSE)
