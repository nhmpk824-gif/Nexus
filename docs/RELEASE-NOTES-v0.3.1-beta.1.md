# Nexus v0.3.1-beta.1

> **Pre-release.** Pure size-fix patch on top of v0.3.0 — **no behavior changes, no new features**. Beta channel because we want to verify the smaller installers still work end-to-end (wake word, ASR, VAD all still load) before promoting to stable v0.3.1.

## Why this exists

The v0.3.0 stable installers shipped at **1.19–1.45 GB per platform** when they should have been ~250 MB. Three pieces of bloat slipped through the electron-builder filter:

| Bloat source | Per-platform size | Why it was there |
|---|---|---|
| `model.onnx` (FP32 SenseVoice) | **894 MB** | The SenseVoice `.tar.bz2` archive ships both FP32 and INT8 versions. The app uses INT8 (`checkFile: model.int8.onnx`) — the FP32 was extracted unused. |
| `paraformer/.git/` | 82 MB | Git LFS clone residue (`.git/lfs/incomplete/`) from how the optional Paraformer model was originally fetched. |
| `**/test_wavs/` (4 dirs) | ~4 MB | Sample audio files shipped with each model archive — useful for command-line testing, never read by Nexus runtime. |

Plus a few smaller leak items (per-model `README.md`, `LICENSE`, `export-onnx.py`).

## What this fixes

`package.json` `extraResources.sherpa-models.filter` now excludes:

```
"!**/model.onnx"
"!**/.git" / "!**/.git/**"
"!**/.gitattributes"
"!**/test_wavs" / "!**/test_wavs/**"
"!**/export-onnx.py"
"!**/README.md"
"!**/LICENSE"
```

Applied to all three platform blocks (win / mac / linux).

## Expected installer sizes

| Platform | v0.3.0 | v0.3.1-beta.1 (target) | Δ |
|---|---|---|---|
| dmg | 1.19 GB | ~250 MB | **−940 MB** |
| exe | 1.19 GB | ~250 MB | **−940 MB** |
| AppImage | 1.45 GB | ~280 MB | **−1.17 GB** |
| deb | 1.33 GB | ~270 MB | **−1.06 GB** |

(Confirmed by build artifact diff once CI lands the build.)

## Backward compatibility

Zero. The shipped binary contents that were ACTUALLY used (`model.int8.onnx`, the wake-word models, Silero VAD) are unchanged byte-for-byte. Pre-v0.3.0 stored state, persona files, and chat history all migrate transparently.

## Auto-update

This is a pre-release on the GitHub Releases page. Stable v0.3.0 users **do not** auto-update to it (electron-updater's "latest release" API excludes pre-releases). Beta channel users, or anyone who manually installs this build, will auto-upgrade to the eventual stable v0.3.1 once it ships.

## How to try it

1. Download from the [v0.3.1-beta.1 release page](https://github.com/FanyinLiu/Nexus/releases/tag/v0.3.1-beta.1).
2. Unsigned build, same as v0.3.0:
   - **macOS**: `xattr -dr com.apple.quarantine /Applications/Nexus.app`
   - **Windows**: SmartScreen "More info → Run anyway"
3. Existing v0.3.0 install data is picked up unchanged.

## What we want validated before stable v0.3.1

- ✅ Wake word still triggers ("Hey Nexus" / "星绘")
- ✅ Voice → text transcription still works (Sense-Voice INT8 still loads)
- ✅ VAD still cuts off speech turns at the right time
- ✅ App still starts within a reasonable window on cold launch (no missing-file errors in logs)

If any of these regress, file an issue against `v0.3.1-beta.1` and we hold the stable promotion.

---

Full commit log between `v0.3.0` and `v0.3.1-beta.1`: [compare](https://github.com/FanyinLiu/Nexus/compare/v0.3.0...v0.3.1-beta.1).
