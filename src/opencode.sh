#!/bin/bash

# =================================================================
# OpenCode TUI Installer for Acode (Alpine Linux)
# =================================================================

set -euo pipefail

# Check running on Alpine Linux
if [ ! -f /etc/alpine-release ]; then
    echo "❌ Error: This script requires Alpine Linux"
    exit 1
fi

echo "🚀 Starting OpenCode TUI setup..."

# 1. Update system and install dependencies
echo "📦 Installing system dependencies..."
if ! apk update; then
    echo "❌ Error: Failed to update package index"
    exit 1
fi

if ! apk add curl bash nodejs npm libc6-compat git; then
    echo "❌ Error: Failed to install dependencies"
    exit 1
fi

# 2. Clean up any previous broken installations
echo "🧹 Cleaning old paths..."
npm uninstall -g opencode-ai 2>/dev/null || true
rm -f /usr/local/bin/opencode
mkdir -p ~/.local/share/opencode/bin

# 3. Run official OpenCode installer
echo "📥 Downloading and installing OpenCode..."
if ! curl -fsSL https://opencode.ai/install -o /tmp/opencode_install; then
    echo "❌ Error: Failed to download OpenCode installer"
    exit 1
fi

if ! bash /tmp/opencode_install; then
    echo "❌ Error: Failed to run OpenCode installer"
    exit 1
fi
rm -f /tmp/opencode_install

# 4. Configure Environment Path
echo "⚙️ Configuring PATH..."
PATH_LINE='export PATH=$HOME/.opencode/bin:$PATH'

if ! grep -q ".opencode/bin" ~/.bashrc 2>/dev/null; then
    echo "$PATH_LINE" >> ~/.bashrc
    echo "✅ Path added to .bashrc"
else
    echo "ℹ️ Path already exists in .bashrc"
fi

# 5. Finalize
hash -r
export PATH=$HOME/.opencode/bin:$PATH

# Verify installation
if command -v opencode >/dev/null 2>&1; then
    echo "----------------------------------------------------"
    echo "🎉 Setup Complete!"
    echo "👉 Run 'opencode' to start."
    echo "----------------------------------------------------"
else
    echo "❌ Error: OpenCode not found in PATH after installation"
    echo "👉 Try: source ~/.bashrc && opencode"
    exit 1
fi