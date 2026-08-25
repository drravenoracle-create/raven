import { getCharacterCore, RAVEN_CHARACTER_CORE, type CharacterCoreConfig } from "./studioos-tenant-config.ts";

export type CharacterCore = {
  characterId: string;
  canonicalName: string;
  corePersonality: string[];
  values: string[];
  specialties: string[];
  worldbuilding: string[];
  visualIdentity?: string[];
};

export type MarketConfig = {
  marketId: string;
  country: string;
  locale: string;
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  pricingRegion?: string | null;
  legalRegion?: string | null;
  paymentProviderRef?: string | null;
  seoRegion?: string | null;
  keywordNamespace?: string | null;
};

export type MarketPersona = {
  characterId: string;
  marketId: string;
  locale: string;
  tone?: string;
  formality?: "casual" | "neutral" | "formal" | string;
  humorStyle?: "none" | "light" | "playful" | "dry" | string;
  relationshipDistance?: "close" | "friendly" | "respectful" | "professional" | string;
  ctaStyle?: "direct" | "soft" | "community-oriented" | "premium" | "playful" | string;
  visualDirection?: string[];
  culturalRules?: string[];
  prohibitedExpressions?: string[];
  contentOverrides?: Record<string, unknown>;
  marketPersonaSchemaVersion?: number;
};

export type LocalizedContentRef = {
  contentKey: string;
  locale: string;
  market: string;
  sourceLocale: string;
  status: "source" | "translated" | "localized" | "review_required";
};

export type GuildMarketDefaults = {
  guildId: string;
  defaultMarket: string;
  defaultCountry: string;
  defaultLocale: string;
  defaultTimezone: string;
  defaultCurrency: string;
};

export type TenantMarketBinding = {
  tenantId: string;
  guildId: string;
  characterId: string;
  marketId: string;
  localizationOverrides?: Partial<MarketConfig>;
};

export type ResolvedTenantMarket = {
  tenant: TenantMarketBinding;
  guild: GuildMarketDefaults;
  market: MarketConfig;
  persona: MarketPersona;
  character: CharacterCore;
};

const PLATFORM_MARKET_DEFAULTS: MarketConfig = {
  marketId: "platform-default",
  country: "US",
  locale: "en-US",
  language: "en",
  timezone: "UTC",
  currency: "USD",
  dateFormat: "yyyy-MM-dd",
  pricingRegion: null,
  legalRegion: null,
  paymentProviderRef: null,
  seoRegion: null,
  keywordNamespace: "platform",
};

export const MARKET_CONFIGS: Record<string, MarketConfig> = {
  jp: {
    marketId: "jp", country: "JP", locale: "ja-JP", language: "ja", timezone: "Asia/Tokyo", currency: "JPY", dateFormat: "yyyy-MM-dd",
    pricingRegion: "JP", legalRegion: "JP", paymentProviderRef: "jp-default", seoRegion: "jp", keywordNamespace: "raven-jp",
  },
  "en-us": {
    marketId: "en-us", country: "US", locale: "en-US", language: "en", timezone: "America/New_York", currency: "USD", dateFormat: "MM/dd/yyyy",
    pricingRegion: "US", legalRegion: "US", paymentProviderRef: "us-default", seoRegion: "en-us", keywordNamespace: "raven-en-us",
  },
};

export const MARKET_PERSONAS: MarketPersona[] = [
  {
    characterId: RAVEN_CHARACTER_CORE.characterId,
    marketId: "jp",
    locale: "ja-JP",
    tone: "mystical, reassuring",
    formality: "neutral",
    humorStyle: "none",
    relationshipDistance: "respectful",
    ctaStyle: "soft",
    visualDirection: ["deep jewel tones", "calm density", "ritual atmosphere"],
    culturalRules: ["respect Japanese honorific expectations", "use Japan date and number conventions"],
    prohibitedExpressions: [],
    marketPersonaSchemaVersion: 1,
  },
  {
    characterId: RAVEN_CHARACTER_CORE.characterId,
    marketId: "en-us",
    locale: "en-US",
    tone: "warm, mystical, concise",
    formality: "friendly",
    humorStyle: "light",
    relationshipDistance: "friendly",
    ctaStyle: "direct",
    visualDirection: ["deep jewel tones", "clear hierarchy", "welcoming atmosphere"],
    culturalRules: ["use US date and number conventions", "avoid presenting spiritual guidance as certainty"],
    prohibitedExpressions: [],
    marketPersonaSchemaVersion: 1,
  },
];

export const GUILD_MARKET_DEFAULTS: Record<string, GuildMarketDefaults> = {
  "raven-guild": { guildId: "raven-guild", defaultMarket: "jp", defaultCountry: "JP", defaultLocale: "ja-JP", defaultTimezone: "Asia/Tokyo", defaultCurrency: "JPY" },
  "test-global-guild": { guildId: "test-global-guild", defaultMarket: "en-us", defaultCountry: "US", defaultLocale: "en-US", defaultTimezone: "America/New_York", defaultCurrency: "USD" },
};

export const TENANT_MARKET_BINDINGS: TenantMarketBinding[] = [
  { tenantId: "raven-oracle", guildId: "raven-guild", characterId: RAVEN_CHARACTER_CORE.characterId, marketId: "jp" },
  { tenantId: "test-up-to-date", guildId: "test-global-guild", characterId: RAVEN_CHARACTER_CORE.characterId, marketId: "en-us" },
];

export class UnknownMarketError extends Error {
  constructor(marketId: string) { super(`Unknown market: ${marketId}`); this.name = "UnknownMarketError"; }
}

export class UnknownCharacterError extends Error {
  constructor(characterId: string) { super(`Unknown character: ${characterId}`); this.name = "UnknownCharacterError"; }
}

export class UnknownTenantMarketError extends Error {
  constructor(tenantId: string) { super(`Unknown tenant market binding: ${tenantId}`); this.name = "UnknownTenantMarketError"; }
}

export class MarketRegistry {
  private readonly configs: Record<string, MarketConfig>;
  constructor(configs: Record<string, MarketConfig> = MARKET_CONFIGS) { this.configs = configs; }
  listMarkets() { return Object.values(this.configs); }
  getMarket(marketId: string) { return this.configs[marketId]; }
}

export class MarketPersonaRepository {
  private readonly personas: MarketPersona[];
  constructor(personas: MarketPersona[] = MARKET_PERSONAS) { this.personas = personas; }
  listPersonas() { return [...this.personas]; }
  getPersona(characterId: string, marketId: string) { return this.personas.find((item) => item.characterId === characterId && item.marketId === marketId); }
}

function adaptCharacterCore(config: CharacterCoreConfig): CharacterCore {
  return {
    characterId: config.characterId,
    canonicalName: config.canonicalName,
    corePersonality: config.persona ? [config.persona] : [],
    values: config.safetyRules || [],
    specialties: config.specialties || [],
    worldbuilding: config.worldbuilding || [],
    visualIdentity: Object.values(config.visualIdentity || {}),
  };
}

export function getCharacterCoreForMarket(characterId: string): CharacterCore {
  const core = getCharacterCore(characterId);
  if (!core) throw new UnknownCharacterError(characterId);
  return adaptCharacterCore(core);
}

export class LocalizationResolver {
  private readonly markets: MarketRegistry;
  private readonly personas: MarketPersonaRepository;
  private readonly guilds: Record<string, GuildMarketDefaults>;
  private readonly bindings: TenantMarketBinding[];

  constructor(options: { markets?: Record<string, MarketConfig>; personas?: MarketPersona[]; guilds?: Record<string, GuildMarketDefaults>; bindings?: TenantMarketBinding[] } = {}) {
    this.markets = new MarketRegistry(options.markets || MARKET_CONFIGS);
    this.personas = new MarketPersonaRepository(options.personas || MARKET_PERSONAS);
    this.guilds = options.guilds || GUILD_MARKET_DEFAULTS;
    this.bindings = options.bindings || TENANT_MARKET_BINDINGS;
  }

  resolveMarketPersona(characterId: string, marketId: string): MarketPersona {
    getCharacterCoreForMarket(characterId);
    const market = this.markets.getMarket(marketId);
    if (!market) throw new UnknownMarketError(marketId);
    const persona = this.personas.getPersona(characterId, marketId);
    if (!persona) throw new UnknownMarketError(`${marketId} for ${characterId}`);
    return { ...persona };
  }

  resolveTenantMarket(tenantId: string): ResolvedTenantMarket {
    const binding = this.bindings.find((item) => item.tenantId === tenantId);
    if (!binding) throw new UnknownTenantMarketError(tenantId);
    const guild = this.guilds[binding.guildId];
    if (!guild) throw new UnknownTenantMarketError(`${tenantId}: guild ${binding.guildId}`);
    const market = this.markets.getMarket(binding.marketId);
    if (!market) throw new UnknownMarketError(binding.marketId);
    const character = getCharacterCoreForMarket(binding.characterId);
    const persona = this.resolveMarketPersona(binding.characterId, binding.marketId);
    return { tenant: { ...binding }, guild: { ...guild }, market: { ...PLATFORM_MARKET_DEFAULTS, ...market, ...binding.localizationOverrides }, persona, character };
  }

  resolveLocalization(tenantId: string): MarketConfig {
    return this.resolveTenantMarket(tenantId).market;
  }
}

export const localizationResolver = new LocalizationResolver();
export const marketRegistry = new MarketRegistry();
export const marketPersonaRepository = new MarketPersonaRepository();

export function resolveMarketPersona(characterId: string, marketId: string) { return localizationResolver.resolveMarketPersona(characterId, marketId); }
export function resolveTenantMarket(tenantId: string) { return localizationResolver.resolveTenantMarket(tenantId); }
export function resolveLocalization(tenantId: string) { return localizationResolver.resolveLocalization(tenantId); }
