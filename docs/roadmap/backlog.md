# Backlog

## Ready Next

### RAV-MVP-001 Server-side tarot draw

- Purpose: prevent AI from choosing or changing cards.
- Done: API returns a selected card id/name from server logic and prompt receives only that card.
- Tests: draw/display consistency and deterministic test fixture.
- Approval: not required.

### RAV-MVP-002 OpenAI prompt builder

- Purpose: generate Raven reading text using OpenAI and per-site persona config.
- Done: prompt builder reads Raven persona and hearing sheet settings.
- Tests: prompt includes Raven persona, excludes other character names.
- Approval: not required after the OpenAI API key is supplied as a secret. Gemini switch requires separate approval.

### RAV-MVP-003 Safety classifier and safe response

- Purpose: avoid ordinary readings for high-risk topics.
- Done: high-risk input returns safety-oriented response before AI reading.
- Tests: crisis, medical, legal, investment, and self-harm examples.
- Approval: not required.

### RAV-MVP-004 Analytics privacy guard

- Purpose: ensure private text never enters GA4.
- Done: event wrapper accepts only approved aggregate params.
- Tests: submit event excludes name, concern, reading text.
- Approval: not required.

### RAV-MVP-005 Release copy and disclaimer

- Purpose: clarify entertainment/self-reflection scope.
- Done: UI contains concise disclaimer without fear or dependency language.
- Tests: rendered text smoke test.
- Approval: user review recommended.

## Later

- Daily limit enforcement.
- Admin dashboard.
- Blog automation.
- STORES payment and ticket flow.
- Timed chat.
- Four additional character sites.