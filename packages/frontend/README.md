# @colobot/frontend

ColoBot Frontend — AI Companion for Everyone

---

## Features

- **Zero Concepts** — No need to know Agent/Provider/SOP or any technical terms
- **Zero Config** — No config files, all settings done through the UI
- **Privacy First** — Your data stays on your device only

---

## What It Does

### Core Features

| Feature | Description |
|---------|-------------|
| Chat | Talk to AI, it remembers what you said |
| Automation | Daily reminders, mood check-ins, weekly summaries |
| Safety | Auto-filters sensitive info to prevent leaks |
| Assistant | Todos, habits, moods, goals, finances, etc. |

### Settings

| Setting | Options |
|---------|---------|
| AI Behavior | Brief/Normal/Detailed, Passive/Greeting/Caring |
| Mental Health | Mood tracking, check-in when down, remind to contact friends |
| Privacy | View what AI remembers, export data, delete data |

---

## Development

### Setup

```bash
cd packages/frontend

# Install dependencies
npm install

# Start mock API (simulates backend)
npx tsx mock-server.ts

# Start dev server
npx vite
```

Visit http://localhost:5173

### Build

```bash
npm run build
```

### Project Structure

```
packages/frontend/
├── src/
│   ├── views/           # Pages
│   │   ├── Home.vue           # Home
│   │   ├── ChatConsole.vue    # Chat
│   │   ├── Agents.vue         # AI Assistants
│   │   ├── Skills.vue         # Automation
│   │   ├── Sentinel.vue       # Safety
│   │   ├── Onboarding.vue     # Setup flow
│   │   ├── Settings/          # Settings
│   │   └── Assistant/         # Personal assistant modules
│   ├── components/      # Components
│   ├── api/             # API layer
│   ├── stores/          # State management
│   └── i18n/            # Internationalization
├── mock-server.ts       # Mock API server
└── dist/                # Build output
```

---

## Tech Stack

- Vue 3 + TypeScript
- Vite
- Pinia
- Vue Router
- ECharts

---

## Related Docs

- [Privacy Policy](../../PRIVACY.md)
- [中文文档](./README.zh-CN.md)
