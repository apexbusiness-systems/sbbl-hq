# .claude/ — APEX Skill Pack for Claude Code

Organized for Claude Code native skill discovery and progressive disclosure.

## Structure
```
.claude/
├── settings.json          → Permission policies
├── commands/              → Slash commands (/project:xxx)
│   ├── apex-power.md
│   ├── debug.md
│   └── qa-gate.md
├── skills/                → Auto-discovered skills
│   ├── apex-power/SKILL.md
│   ├── omnidev-v2/SKILL.md
│   ├── apex-master-debug/SKILL.md
│   ├── apex-frontend/SKILL.md
│   ├── apex-omnitest/SKILL.md
│   ├── apex-qa/SKILL.md
│   ├── apex-memory/SKILL.md
│   └── sbbl-agent/SKILL.md
└── README.md
```

## Skill Map
```
apex-power (meta) → omnidev-v2 | apex-master-debug | apex-frontend
                  → apex-omnitest | apex-memory | apex-qa
sbbl-agent (project context) → domain awareness for all skills
```

_APEX Business Systems Ltd._
