# Nexus v0.4.7 Stable Release Handoff

Status: Stable unsigned release handoff.

v0.4.7 is the current stable version. The owner recorded a version-scoped
maintainer exception in `RELEASING.md` to promote this exact tree after the
automated gate, waiving the remaining standard beta flow and beta validation
window. The 2026-08-10 `v0.4.7-beta.1` preparation record remains historical
and does not describe this tree. The previously published `v0.4.6-beta.1` and
`v0.4.5 beta` releases stay as prior pre-release evidence. Official binaries
must still be rebuilt from the release commit by the protected tag workflow.

## Release content boundary

- Cubism import validation for Moc, textures, and declared local resources
- five-locale repair guidance and limited-versus-blocked activation results
- privacy-safe diagnostic summaries (categories and counts, not private paths)
- Portrait Puppet v4 layered packs as the default in-app picture path
- single-portrait v3 fallback; existing package import and Creator Kit retained
- sharp image/atlas-to-sprite generator stays removed
- Grok STT/TTS via xAI
- Qwen 3.8-max / GLM-5.3 catalog defaults and settings schema v7 remapping
- stable `NEXUS_ERR_*` timeout classification
- v0.4.6 avatar-runtime reliability work carried forward

## Evidence boundary

The release commit must pass `verify:release`, Live2D smoke, packaged smoke,
the sustained runtime gate, and `prerelease-check -- v0.4.7`. CI must be green
on macOS, Windows, and Linux before the protected tag workflow publishes
artifacts. No cross-platform physical-device evidence is claimed.

The macOS arm64 build remains ad-hoc signed and not notarized. The Windows x64
installer remains unsigned. Users should use only the official GitHub Release
and verify the published platform checksum.

## Promotion record

The v0.4.7 stable promotion updates the package version, release spotlight,
README stable entries, release notes, changelog, roadmap, and release audit
anchors from v0.4.6. The v0.4.6 notes and handoff remain as the previous public
stable record.
