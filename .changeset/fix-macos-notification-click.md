---
"ralph": patch
---

Fix macOS notification click behavior to focus terminal

When terminal-notifier is installed, notifications now use the -activate flag to focus the terminal application when clicked. The implementation detects the current terminal (iTerm2, Apple Terminal, Hyper, Alacritty, kitty, WezTerm, Ghostty) and activates it on notification click. Falls back to standard AppleScript notifications when terminal-notifier is not available.
