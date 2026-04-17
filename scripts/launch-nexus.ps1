# Desktop launcher for Nexus that always runs the latest source tree.
#
# The NSIS-installed exe bundles a frozen renderer from whichever commit
# was last packaged — changes landed in git afterwards never reach it.
# This script replaces that shortcut with a "build-then-run" flow so that
# double-clicking the icon always picks up the latest commit.
#
# Trade-off: adds ~15-30 s of `tsc -b && vite build` on every launch.
# Skip this script and keep the NSIS shortcut when you want fast cold
# start from a known-stable packaged build.

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'F:\nexus'
Set-Location -Path $ProjectRoot

Write-Host '[Nexus launcher] Building renderer + main...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host '[Nexus launcher] Build failed — aborting launch.' -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit $LASTEXITCODE
}

Write-Host '[Nexus launcher] Starting electron...' -ForegroundColor Cyan
npx electron .
