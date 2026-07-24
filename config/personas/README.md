# Persona configs

Each site/account can have its own persona file.
Each persona can also be tuned from a hearing sheet under
`config/hearing-sheets/`.

Current persona:

- `raven-oracle.json`
- Owner account: `dr.ravenoracle@gmail.com`
- Environment selector: `RAVEN_PERSONA_ID=raven-oracle`

To add another site persona:

1. Add a new JSON file in this folder.
2. Add a matching hearing-sheet JSON in `config/hearing-sheets/` when the
   person's interview sheet is available.
3. Import both files in `app/lib/personas.ts`.
4. Add the hearing sheet to the `hearingSheets` map.
5. Add the merged persona to the `personas` map.
6. Set `RAVEN_PERSONA_ID` to the new `id`.

## Hearing sheet update flow

Convert each person's interview answers into this normalized shape:

- `profile.targetAudience`
- `profile.desiredImpression`
- `profile.avoidImpression`
- `profile.preferredLanguage`
- `voice.personality`
- `voice.tone`
- `voice.styleRules`
- `serviceRules.readingLabels`
- `serviceRules.chatInstruction`

Keep raw interview documents outside runtime code when possible. Store only the
summarized tuning instructions needed by the model.

Do not store API keys in these files. Use environment variables for secrets.
