# Agent Instructions

## Deployment Restrictions

- Never use OpenAI Sites / ChatGPT Sites for Raven Oracle.
- Never create, publish, deploy, preview, verify, test, route, configure, mention as a deliverable, or share any `*.chatgpt.site` URL for Raven Oracle.
- Never use, publish to, preview with, reference as a delivery target, or configure any `*.isao-omiya.chatgpt.site` URL for this project.
- Do not treat `chatgpt.site` as a fallback, temporary preview, private preview, staging URL, or emergency deployment target.
- If a tool suggests or returns a `chatgpt.site` URL, do not use it in the final answer and do not continue deploying there. Stop and switch to the official Cloudflare path.
- The Raven Oracle site must be published only through the Cloudflare Raven Worker/site controlled for this project.
- The production domain for Raven Oracle is `raven.fortunestudios.jp`.
- Before any deployment, confirm the exact destination is `raven.fortunestudios.jp` or the Cloudflare `raven-oracle` Worker backing that domain.

## Filesystem Restrictions

- Do not create, edit, copy, move, or store project files under `C:\Users\user` or any user-folder subdirectory.
- Do not use the user folder as a workspace, cache location, deployment staging area, archive output, or temporary project output location.
- Reading files under the user folder is allowed only when necessary for reference and when the user has permitted reference-only access.
- Project work for Raven Oracle must stay under `C:\dev\Projects\FM000_Raven-Oracle` unless the user explicitly names another non-user-folder path.
