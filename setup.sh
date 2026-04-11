#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  Nexus Setup (macOS / Linux)"
echo "============================================"
echo

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "[Error] Node.js not found. Please install Node.js (https://nodejs.org)"
  exit 1
fi

echo "[Info] Node.js version: $(node -v)"

# Step 1: Install dependencies
echo
echo "[1/2] Installing npm dependencies..."
npm install
echo "[Done] Dependencies installed."

# Step 2: Build project
echo
echo "[2/2] Building project..."
npm run build
echo "[Done] Build complete."

echo
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo
echo "  Start dev mode:     npm run electron:dev"
echo "  Package (macOS):    npm run package:mac"
echo "  Package (Linux):    npm run package:linux"
echo
