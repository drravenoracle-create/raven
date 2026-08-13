# Release Policy

## Release Gate

Before production release:

- Build passes.
- Relevant tests pass.
- Analytics does not include private text.
- Environment variables are configured.
- Rollback path is known.
- User approval is recorded when release scope requires it.

## Current Release Strategy

Release Raven free AI fortune only. Keep AI text reading as Coming soon. Initial AI generation uses OpenAI; Gemini is a later option that requires explicit approval before switching.