import ravenOracle from "../../config/personas/raven-oracle.json";
import ravenOracleHearingSheet from "../../config/hearing-sheets/raven-oracle.json";

export type PersonaConfig = {
  id: string;
  displayName: string;
  ownerAccount: string;
  site: string;
  language: string;
  personality: string[];
  tone: string[];
  styleRules: string[];
  readingLabels: string[];
  chatInstruction: string;
};

type HearingSheetConfig = {
  personaId: string;
  profile?: {
    preferredLanguage?: string;
  };
  voice?: {
    personality?: string[];
    tone?: string[];
    styleRules?: string[];
  };
  serviceRules?: {
    readingLabels?: string[];
    chatInstruction?: string;
  };
};

function mergePersonaWithHearingSheet(
  persona: PersonaConfig,
  hearingSheet?: HearingSheetConfig,
): PersonaConfig {
  if (!hearingSheet) return persona;

  return {
    ...persona,
    language: hearingSheet.profile?.preferredLanguage ?? persona.language,
    personality: [
      ...persona.personality,
      ...(hearingSheet.voice?.personality ?? []),
    ],
    tone: [...persona.tone, ...(hearingSheet.voice?.tone ?? [])],
    styleRules: [
      ...persona.styleRules,
      ...(hearingSheet.voice?.styleRules ?? []),
    ],
    readingLabels: hearingSheet.serviceRules?.readingLabels ?? persona.readingLabels,
    chatInstruction: hearingSheet.serviceRules?.chatInstruction ?? persona.chatInstruction,
  };
}

const hearingSheets: Record<string, HearingSheetConfig> = {
  [ravenOracleHearingSheet.personaId]: ravenOracleHearingSheet,
};

const personas: Record<string, PersonaConfig> = {
  [ravenOracle.id]: mergePersonaWithHearingSheet(
    ravenOracle,
    hearingSheets[ravenOracle.id],
  ),
};

export function getPersona(id = "raven-oracle") {
  return personas[id] ?? personas["raven-oracle"];
}

export function personaSystemPrompt(persona: PersonaConfig) {
  return [
    `You are ${persona.displayName}.`,
    `Site: ${persona.site}.`,
    `Owner account: ${persona.ownerAccount}.`,
    `Primary language: ${persona.language}.`,
    "",
    "Personality:",
    ...persona.personality.map((item) => `- ${item}`),
    "",
    "Tone:",
    ...persona.tone.map((item) => `- ${item}`),
    "",
    "Style rules:",
    ...persona.styleRules.map((item) => `- ${item}`),
  ].join("\n");
}
