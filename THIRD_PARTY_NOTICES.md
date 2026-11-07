# Third-party notices

## Pixel Chat Themes

- Author: **aqua2409z**
- Source: <https://github.com/aqua2409z/pixel-chat-themes>
- Input version: userscript **1.2.0**, from the user-supplied `pixel-chat-themes-main.zip`.
- License: MIT, copyright (c) 2026 aqua2409z; full notice retained in `LICENSE`.

`src/engine.js` contains the drawing utilities, World class, sprites and nine theme definitions extracted from that userscript. The generated `pixel-runtime.js` includes this engine. Claude-specific page scanning, chat-command interception and original UI were replaced with a Codex-specific adapter.

## Launcher implementation references

The following projects were consulted for the Windows package identity and CDP launch approach. Their prebuilt executables are not bundled:

- <https://github.com/JonathandNidhog/dsh-plugin-wallpaper-engine-codex>
- <https://github.com/codecnmc/codex-theme-inject>

OpenAI, Codex, ChatGPT and GitHub are trademarks of their respective owners. This project is an unofficial customization.
