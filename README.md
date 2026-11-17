# Lingua Dark starter kit for Claude Code

Copy this folder's contents into the root of an empty repo, then follow `docs/PROMPTS.md`.

| File | What it is |
| --- | --- |
| `CLAUDE.md` | Project rules Claude Code loads automatically: the anti-shortcut rules, architecture, conventions |
| `docs/SPEC.md` | Implementation spec: combat rules, tuning constants, content system, learning, exploration, art, types, tests, milestones |
| `docs/PROMPTS.md` | Kickoff prompt plus one prompt per milestone, and three utility prompts |
| `docs/DECISIONS.md` | Settled and open design decisions |
| `src/content/data/lexicon.json` | Seed lexicon: 27 nouns and 11 regular present-tense verbs, with Spain Spanish forms |
| `src/content/data/templates.json` | Pronouns, articles, and 5 Zone 1 templates (including a two-blank combo) |
| `src/content/data/zone1-rooms.json` | Zone 1 room graph: 9 rooms, a shortcut door, a boss gate, and Spanish signs |

All Spanish text is a draft and needs native-speaker review before release. The full narrative design doc stays in Claude; export it from the doc's menu as Markdown if you want it in the repo too.
