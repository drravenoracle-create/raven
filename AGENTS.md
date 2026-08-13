# Agent Instructions

## Deployment Restrictions

- Never use OpenAI Sites / ChatGPT Sites for Raven Blackwood.
- Never create, publish, deploy, preview, verify, test, route, configure, mention as a deliverable, or share any `*.chatgpt.site` URL for Raven Blackwood.
- Never use, publish to, preview with, reference as a delivery target, or configure any `*.isao-omiya.chatgpt.site` URL for this project.
- Do not treat `chatgpt.site` as a fallback, temporary preview, private preview, staging URL, or emergency deployment target.
- If a tool suggests or returns a `chatgpt.site` URL, do not use it in the final answer and do not continue deploying there. Stop and switch to the official Cloudflare path.
- The Raven Blackwood site must be published only through the Cloudflare Raven Worker/site controlled for this project.
- The production domain for Raven Blackwood is `raven.fortunestudios.jp`.
- Before any deployment, confirm the exact destination is `raven.fortunestudios.jp` or the Cloudflare `raven-oracle` Worker backing that domain.

## Existing Feature Protection

- Existing features must not be deleted, replaced, disabled, hidden, or bypassed unless the user explicitly requests that exact removal.
- Before implementing any change, inspect the existing code, routes, APIs, D1 schema, admin screens, settings, scheduled jobs, and deployment configuration that may be affected.
- Before editing, create a short working inventory of the existing behavior and preserve it during the change.
- New work should be additive by default. Extend existing modules, routes, tables, settings, and UI instead of replacing them.
- If an existing implementation appears broken, first verify whether it worked in a previous commit, migration, database state, or deployment before claiming it does not exist.
- If a feature must be moved or refactored, keep the original user-facing behavior and URLs working unless the user approves a change.
- Do not remove published content, scheduled content, database rows, static fallback content, routes, bindings, secrets, cron triggers, or management UI sections without explicit approval.
- Public blog content is DB-backed through `blog_engine_articles`. Static blog data is fallback only and must not be treated as the source of truth when DB content exists.
- Blog Engine, SNS Engine, Growth Engine, analytics, auth, and Cloudflare routing are production features. Treat regressions in any of them as blockers before deployment.
- When deploying, verify not only build success but also representative production URLs and APIs for the affected feature.

## Filesystem Restrictions

- Do not create, edit, copy, move, or store project files under `C:\Users\user` or any user-folder subdirectory.
- Do not use the user folder as a workspace, cache location, deployment staging area, archive output, or temporary project output location.
- Reading files under the user folder is allowed only when necessary for reference and when the user has permitted reference-only access.
- Project work for Raven Blackwood must stay under `C:\dev\Projects\FM000_Raven-Oracle` unless the user explicitly names another non-user-folder path.
