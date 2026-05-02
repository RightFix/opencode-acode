# OpenCode Alpine Installer for Acode

A plugin to install and manage [OpenCode](https://opencode.ai) on Alpine Linux in Acode mobile editor.

## Features

- One-click OpenCode installation on Alpine Linux
- Check OpenCode version
- Login to OpenCode
- Update OpenCode to latest version
- Uninstall OpenCode

## Requirements

- Acode editor (v290+)
- Acode's built-in terminal (Alpine Linux environment)
- Internet connection

## Installation

### Option 1: Download Pre-built Plugin

1. Download `dist.zip` from the releases or build from source
2. Open Acode
3. Go to **Settings > Plugins**
4. Click the **+** icon
5. Select **LOCAL** and choose the downloaded `dist.zip` file

### Option 2: Build from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/RightFix/opencode-alpine-installer-Acode.git
   cd opencode-alpine-installer-Acode
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. The `dist.zip` file will be created in the project directory

5. Transfer `dist.zip` to your phone and install in Acode

## Usage

After installation, access the plugin via:

1. **Command Palette** (Ctrl+Shift+P) - Search for "OpenCode"

2. **Commands available:**
   - `OpenCode: Install` - Downloads and installs OpenCode for Alpine Linux
   - `OpenCode: Check Version` - Shows installed OpenCode version
   - `OpenCode: Login` - Opens OpenCode authentication
   - `OpenCode: Update` - Updates OpenCode to latest version
   - `OpenCode: Uninstall` - Removes OpenCode from your device
   - `OpenCode: Show Menu` - Opens interactive menu with all options

## Getting Started

1. Install OpenCode using the **"OpenCode: Install"** command
2. Wait for the installation to complete
3. Login using **"OpenCode: Login"**
4. Start using OpenCode in the terminal

## Troubleshooting

- If installation fails, ensure you have an active internet connection
- Make sure Acode's terminal is properly configured
- Try running `apk update` in the terminal before installing
- Check the terminal output for any error messages

## Development

### Project Structure

```
opencode-alpine-installer-Acode/
├── src/
│   └── main.js       # Plugin source code
├── plugin.json       # Plugin configuration
├── package.json      # NPM dependencies
├── esbuild.config.mjs # Build configuration
├── icon.png          # Plugin icon
├── readme.md         # Documentation
└── dist.zip          # Built plugin (for distribution)
```

### Build Commands

- `npm run build` - Build the plugin and create dist.zip
- `npm run dev` - Development mode with file watching

## License

MIT