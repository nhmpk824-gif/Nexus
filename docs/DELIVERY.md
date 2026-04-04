# Nexus Delivery Guide

## Release Status

Nexus is currently in a shippable desktop-release state.

Validated commands:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run smoke`
- `npm run package:dir`
- `npm run package:win`
- `npm run verify:release`

Verified runtime behavior:

- The unpacked desktop build launches successfully.
- The packaged Windows executable launches successfully.
- The packaged app falls back automatically when the preferred renderer port
  `127.0.0.1:47822` is already occupied.

## Release Artifacts

Primary local release outputs:

- `release/Nexus-Setup-0.0.0.exe`
- `release/win-unpacked/`

Useful metadata files:

- `release/latest.yml`
- `release/builder-debug.yml`

## Recommended Release Commands

Daily engineering verification:

```bash
npm run lint
npm test
npm run build
npm run smoke
```

Full local release verification:

```bash
npm run verify:release
```

Unsigned Windows installer build:

```bash
npm run package:win
```

Signed Windows installer build:

```bash
npm run package:win:signed
```

## Packaging Notes

- Local unsigned packaging uses `signAndEditExecutable=false` to avoid the
  Windows metadata-edit/signing step during normal developer builds.
- Signed release builds should use `npm run package:win:signed` in an
  environment where signing is configured.
- `electron/mediaSession.ps1` is unpacked at package time so the packaged app
  can still execute the media-session bridge.
- Large ML-related chunks such as local Whisper worker assets and Transformers
  browser runtime assets are intentionally lazy-loaded. The main application
  runtime bundle has been reduced so startup-critical UI code stays separate
  from optional local AI pipelines.

## Architecture Pointers

- Structure overview: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Live2D import notes: [ADDING_LIVE2D_MODEL.md](./ADDING_LIVE2D_MODEL.md)

---

## 中文交付说明

### 当前状态

Nexus 目前已经达到本地可提交、可交付的桌面版本状态。

已重新验证的命令：

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run smoke`
- `npm run package:dir`
- `npm run package:win`
- `npm run verify:release`

已确认的运行行为：

- 未安装版目录可以正常启动。
- Windows 打包后的 `Nexus.exe` 可以正常启动。
- 当首选渲染端口 `127.0.0.1:47822` 被占用时，打包版会自动回退到可用端口，不会因为端口冲突直接失败。

### 交付产物

- `release/Nexus-Setup-0.0.0.exe`
- `release/win-unpacked/`

### 建议验收命令

日常工程检查：

```bash
npm run lint
npm test
npm run build
npm run smoke
```

完整本地交付验证：

```bash
npm run verify:release
```

### 打包说明

- 本地无签名打包使用 `signAndEditExecutable=false`，避免在普通开发环境卡在签名步骤。
- 需要正式签名时，使用 `npm run package:win:signed`。
- `electron/mediaSession.ps1` 已按打包运行时要求解包，安装版/便携版都能继续使用媒体会话桥接。
- 目前仍然较大的 chunk 主要来自本地 Whisper Worker 和 Transformers 浏览器运行时，它们都是按需懒加载，不会再把主界面启动包体一起拖大。
