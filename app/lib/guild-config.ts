export type GuildConfig = { id: string; displayName: string };

export const RAVEN_GUILD_CONFIG: GuildConfig = { id: "raven-guild", displayName: "Raven Oracle Guild" };

export function getGuildConfig(id = RAVEN_GUILD_CONFIG.id) {
  return id === RAVEN_GUILD_CONFIG.id ? RAVEN_GUILD_CONFIG : undefined;
}
