# ColoBot

<div align="center">

**TypeScript AI Agent Framework with Built-in Security Guardian**

Multi-modal AI × Security Parent Agent × Personal Assistant

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org/)

</div>

---

## Introduction

ColoBot is a **TypeScript AI Agent framework with built-in security guardian**.

It transforms the "personal assistant" concept into a programmable, extensible modular system, featuring an **industry-first independent security parent agent**.

---

## Philosophy

ColoBot is not about making AI sound more human. It's about making AI more like a friend who cares about you — and always respects you.

This "human-likeness" is achieved through **architecture** — real-time evaluation, privacy boundaries, security parent agent, progressive autonomy.

---

## Why ColoBot

| Problem | Solution |
|---------|----------|
| **Unbypassable Security** | Independent security parent agent guards all messages |
| **Reusable Knowledge** | SOP encapsulates complex workflows into shareable modules |
| **Modular to the Core** | 18 personal assistant modules ready to use |

---

## Package Structure

```
colobot/
├── packages/
│   ├── types/           # Type definitions
│   ├── sentinel/        # Security Guardian
│   ├── core/            # Core runtime
│   ├── assistant/       # Personal assistant modules
│   ├── tui/             # Terminal UI
│   ├── frontend/        # Vue 3 Web UI
│   ├── sop-base/        # SOP flow engine base
│   └── sop-academic/    # Academic SOP
└── _legacy/             # Legacy code
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/your-repo/colobot.git
cd colobot

# Install
npm install

# Build
npm run build:packages

# Run CLI
npx colobot

# Run TUI
npx colobot tui
```

---

## Core Features

### 🛡️ Security Guardian (@colobot/sentinel)

Independent security parent agent with parallel chain architecture:

- Input/Output scanning (Trie tree, regex, <1ms)
- Heartbeat monitoring (2s interval)
- State synchronization
- Timeout handling (30s warning → 60s inquiry → 120s takeover)
- Three-layer defense: Rule engine → Local model → LLM takeover

### 🤖 Agent Core (@colobot/core)

- Multi-Provider: OpenAI / Anthropic / MiniMax
- Fallback chain degradation
- SSE streaming response
- Context compression
- Sub-Agent pooling
- Tool whitelist

### 🐍 Python WASM Sandbox

- No system Python required (Pyodide)
- Cross-platform
- Secure isolation
- Dynamic package installation (numpy, pandas, etc.)

### 📋 Personal Assistant (@colobot/assistant)

18 modules: Todo, Reminders, Calendar, Notes, Habits, Moods, Finance, Health, Learning, Reading, Goals, Contacts, Projects, Password Manager, Time Tracking, Bookmarks, Intent Recognition, User Profile

### 🖥️ Web UI (@colobot/frontend)

Vue 3 + TypeScript interface:

- Chat Console with SSE streaming
- Agents/Skills management
- Sentinel dashboard
- All assistant modules
- Achievement system with animations
- Mood heatmap
- Command palette (⌘K)

---

## Development

```bash
# Build all
npm run build:packages

# Build single
npm run build --workspace=packages/core

# Test
npm test

# Type check
npx tsc --noEmit
```

### Frontend Development

```bash
cd packages/frontend
npm install

# Mock API
npx tsx mock-server.ts

# Dev server
npm run dev
```

---

## SOP Ecosystem

```
@colobot/sop-base       # Flow engine base (Official)
@colobot/sop-academic   # Academic research flow (Official)
colobot-sop-*           # Community contributions
```

---

## Project Stats

| Metric | Value |
|--------|-------|
| Version | 0.3.1 |
| Code | ~28,500 lines |
| Files | 146 |
| Packages | 8 |
| Modules | 18 |
| Tests | 522 |
| Coverage | 56%+ |

---

## License

[AGPL-3.0](LICENSE)

---

## 中文文档

[查看中文 README](./README.zh-CN.md)