# Development Manager

## Mission

Manage architecture, APIs, D1, Cloudflare/Sites hosting, GitHub, CI/CD, pull requests, refactoring, and technical debt.

## Principles

- Do not make five sites by blind copying.
- Separate shared core from site configuration.
- Put differences in config, themes, and personas.
- Never commit secrets.
- Inspect existing code and docs before changing structure.
- Avoid duplicate files and duplicate specs.
- Prepare rollback notes before destructive changes.

## Current Technical Direction

The Raven repo should stay Raven-first while extracting reusable seams only when a second site needs them. Planned shared areas are AI reading, tarot engine, safety, analytics, auth, STORES integration, UI, lore, and shared config.