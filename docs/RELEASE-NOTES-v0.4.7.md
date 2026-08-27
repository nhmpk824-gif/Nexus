# Nexus v0.4.7 — Avatar Compatibility, Portrait v4, and Catalog

**Status: Stable unsigned release.** v0.4.7 is the current stable version and
this document is its formal release record. The owner recorded a version-scoped
maintainer exception in `RELEASING.md` to promote this exact tree after the
automated gate, waiving the remaining standard beta flow window. Official
assets are created only from the release commit by the protected tag workflow.

v0.4.7 is a companion-avatar and catalog release. It validates imported Cubism
models before activation, ships Portrait Puppet v4 as the default picture path,
keeps Grok speech and current Qwen 3.8 / GLM-5.3 catalog defaults, and retains
the v0.4.6 avatar-runtime reliability work.

## What changed

### Live2D import compatibility

- Imported Cubism models validate Moc, textures, and declared local resources
  before activation.
- Missing motions or expressions stay renderable with a limited-interaction
  notice instead of a hard block.
- Five localized repair messages cover missing textures, motions, expressions,
  and unsafe paths without exposing private local file paths.
- Switch evidence retains Moc, texture, motion, and expression counts.

### Portrait Puppet v4

- Layered portrait packs (`preview.png` + `parts/*.png`) are the default
  in-app picture path.
- A single portrait still works as a fallback v3 puppet. Existing Live2D and
  sprite packages remain importable. Creator Kit authoring stays available.
- Direct image/atlas-to-sprite generation stays removed; v0.4.7 does not
  restore the sharp atlas maker.

### Speech, catalog, and runtime

- Grok STT/TTS via xAI is available on the speech surface.
- DashScope / Model Studio default to `qwen3.8-max`; Z.ai defaults to
  `glm-5.3`. Settings schema v7 remaps retired catalog defaults.
- Chat, speech, and network timeouts use stable `NEXUS_ERR_*` codes.

## Validation boundary

The release commit must pass `verify:release`, the Live2D smoke, packaged smoke,
the sustained runtime gate, and the full `prerelease-check -- v0.4.7` flow before
the protected tag workflow publishes assets. Cross-platform CI must be green on
macOS, Windows, and Linux.

No cross-platform physical-device evidence is claimed. macOS builds are arm64,
ad-hoc signed, and not notarized; Windows x64 installers remain unsigned.
Users should download only from the official GitHub Release and verify the
published platform checksum. On macOS, Gatekeeper may require right-clicking
Nexus.app and choosing Open, or running
`xattr -dr com.apple.quarantine /Applications/Nexus.app`.

## Scope boundary

- No dependency upgrade, storage migration, telemetry, or new desktop sensing.
- No v0.5 locomotion, mouse/typing reactions, or physical-device control.
- The sharp image/atlas pet generator remains outside the stable product
  surface; portrait v4, package import, and Creator Kit are the supported
  pet paths in this release.
