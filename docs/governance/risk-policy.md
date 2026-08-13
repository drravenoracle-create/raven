# Risk Policy

## Primary Risks

- Privacy leakage through analytics or logs.
- AI overclaiming hidden facts, future outcomes, or high-risk decisions.
- Persona mixing across sites.
- Double charging or lost ticket rights in future paid flows.
- Custom domain misrouting.
- Secret exposure in GitHub or build output.

## Controls

- Keep secrets in environment variables only.
- Keep consultation and reading text out of GA4.
- Use server-side card draw.
- Use safety classifier before ordinary AI reading.
- Add rollback notes for releases and database changes.