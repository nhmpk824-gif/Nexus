# Nexus v0.4.7 — 形象兼容、立绘 v4 与模型目录

**状态：正式未签名稳定版。** v0.4.7 是当前稳定版本，本文档是它的正式发行记录。
维护者在 `RELEASING.md` 中为本版本记录了范围限定例外：在自动化门禁通过后直接
晋升，豁免剩余的标准 beta 流程窗口。正式产物只由受保护的 tag 工作流从发布提交
创建。

v0.4.7 是一次形象兼容与目录更新：导入 Cubism 模型会在激活前检查资源；分层立绘
v4 成为默认图片路径；Grok 语音与当前 Qwen 3.8 / GLM-5.3 目录默认进入正式版，
并保留 v0.4.6 的形象运行时可靠性工作。

## 变化

### Live2D 导入兼容

- 导入 Cubism 模型时，会在激活前检查 Moc、纹理和已声明的本地资源。
- 缺少动作或表情时仍可显示，并给出有限互动提示，而不是直接拒绝。
- 五语言修复说明覆盖缺失纹理、动作、表情和不安全路径，不暴露私人本地路径。
- 切换证据保留 Moc、纹理、动作和表情数量。

### 分层立绘 v4

- 分层立绘包（`preview.png` + `parts/*.png`）是应用内默认图片路径。
- 单张立绘仍可作为 v3 回退。现有 Live2D / Sprite 包仍可导入，Creator Kit
  创作路径保留。
- 直接从图片/Atlas 生成 sprite 的功能仍不在稳定版里；本版不恢复 sharp atlas
  生成器。

### 语音、目录与运行时

- Grok STT/TTS（xAI）进入语音表面。
- DashScope / 模型工作室默认 `qwen3.8-max`；Z.ai 默认 `glm-5.3`。设置 schema
  v7 会重映射已退役的目录默认值。
- 聊天、语音和网络超时使用稳定的 `NEXUS_ERR_*` 错误码。

## 验证边界

发布提交必须通过 `verify:release`、Live2D 烟测、打包 smoke、持续运行门禁，以及
完整的 `prerelease-check -- v0.4.7` 流程，然后才由受保护的 tag 工作流发布产物。
macOS、Windows 和 Linux 的 CI 必须在该提交上全绿。

不会虚构跨平台实体设备验证证据。macOS 构建为 arm64、ad-hoc 签名且未公证；
Windows x64 安装器仍未签名。用户应只从官方 GitHub Release 下载，并核对发布的
平台校验和。macOS 首次启动如果被 Gatekeeper 拦截，可右键点击 Nexus.app
选择“打开”，或运行 `xattr -dr com.apple.quarantine /Applications/Nexus.app`。

## 范围边界

- 不升级依赖，不新增存储迁移、遥测或桌面感知来源。
- 不包含 v0.5 的移动、鼠标/打字反应或实体设备控制。
- 直接从图片/Atlas 生成 sprite 的功能仍不进入稳定版产品面；本版本支持立绘
  v4、宠物包导入与 Creator Kit 创作路径。
