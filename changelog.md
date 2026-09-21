# Changelog

## 2.0.0

- Fix `t.add is not a function` crash in command registration.
- Use Commands API `addCommand({ name, description, exec })` / `removeCommand(name)` with fallbacks (`commands` -> `registry` -> `acode.addCommand` -> legacy `editor.commands`).
- Harden `registerCommands` / `destroy` with `try/catch` so init can't abort before the side button.
- Fix `getDirectory()` typo: `files/alphine/home` -> `files/alpine/home`.
- Switch install/update/uninstall to npm-only: `npm install -g opencode-ai`, `npm install -g opencode-ai@latest`, `npm uninstall -g opencode-ai`. Removed curl|bash and `~/.opencode` cleanup.
- Register side-button icon via `acode.addIcon()` so it renders on all builds.
- Add `acode.require('toast')` feedback for install/update/uninstall/checkVersion/errors.
- Quote `cd` path and guard unresolvable directories to avoid breakage on paths with spaces.
- Remove unused `baseUrl` property and `getHeader()` dead code.
- Package `changelog.md` + `LICENSE` into `dist.zip`.
- Update docs for npm-only flow and AGPL-3.0 license.

## 1.1.0

- Fixed a bug.
- Added support for both versions of Acode.

## 1.0.0

- Initial release.
