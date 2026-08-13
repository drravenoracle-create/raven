# Open Questions And Approval Gates

This file tracks information that must not be guessed. Stop and ask the user before acting on any item below.

## Account And Key Questions

| Item | Current state | Required before action |
| --- | --- | --- |
| Raven OpenAI API key | Initial AI provider | User provides the key or confirms it has been set as a secret in the hosting environment. |
| Raven Gemini API key | Not used for initial release | Ask before switching Raven from OpenAI to Gemini. |
| Other character Google accounts | Unknown | User provides account/project details per site. |
| Other character GA4 IDs | Unknown | User provides measurement IDs before analytics setup. |
| Cloudflare access | User manages DNS in Cloudflare | Ask before changing DNS records or requesting Cloudflare-side changes. |
| `raven.fortunestudios.jp` DNS | Configured for Raven Sites | Re-check before future DNS changes. |
| STORES API/account | Not confirmed | User confirms account, API availability, products, and approval for paid integration. |
| LINE account/channel | Not confirmed | User confirms account/channel before LINE implementation. |

## Product And Brand Approval Gates

Ask before:

- Finalizing official prices.
- Publishing legal text.
- Changing character lore, names, roles, or tone.
- Enforcing user accounts, history storage, or paid ticket behavior.
- Adding new fixed-cost services.
- Publishing a new production release outside the already approved Raven free fortune scope.
- Switching the production AI provider.

## Current Safe Autonomous Work

The following can proceed without additional account information:

- Local docs and backlog updates.
- Refactoring prompt/persona config without changing official lore.
- Adding tests for analytics privacy and AI safety.
- Implementing server-side tarot draw without external API calls.
- Preparing OpenAI-backed AI generation behind environment variables without committing secrets.
- Keeping Gemini code optional and inactive until explicitly approved.