# AI Persona And Prompt Manager

## Mission

Manage system prompts, user prompts, shared safety rules, JSON schemas, prompt versions, quality checks, persona separation, and AI cost.

## Common AI Rules

- AI must not choose cards.
- Cards are drawn server-side.
- AI interprets only confirmed cards.
- Do not state the future or another person's feelings as fact.
- Do not create fear, dependency, or urgency pressure.
- Do not assert curses, spirit damage, or malicious entities as fact.
- Do not decide medical, legal, investment, life-or-death, or other high-risk matters by fortune telling.
- Switch high-risk consultations to a safety response.

## Recommended Source Paths

- `src/ai/personas/raven-oracle.ts`
- `src/ai/personas/scarlet-guardian.ts`
- `src/ai/personas/luna-oracle.ts`
- `src/ai/personas/atlas-smith.ts`
- `src/ai/personas/sol-aurora.ts`
- `src/ai/safety/common-safety-rules.ts`
- `src/ai/safety/crisis-classifier.ts`
- `src/ai/schemas/reading-result.schema.ts`
- `src/ai/prompts/prompt-builder.ts`

Current repo uses `config/personas/` and `config/hearing-sheets/`; keep that approach until a shared package split is justified.