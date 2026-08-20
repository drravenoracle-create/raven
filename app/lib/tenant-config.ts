import { RAVEN_CHARACTER_CONFIG } from "./character-config";

export type TenantConfig = { id: string; displayName: string; primaryCharacterId: string; character: typeof RAVEN_CHARACTER_CONFIG };

export const RAVEN_TENANT_CONFIG: TenantConfig = { id: RAVEN_CHARACTER_CONFIG.tenantId, displayName: "Raven Oracle", primaryCharacterId: RAVEN_CHARACTER_CONFIG.id, character: RAVEN_CHARACTER_CONFIG };

export function getTenantConfig(id = RAVEN_TENANT_CONFIG.id) {
  return id === RAVEN_TENANT_CONFIG.id ? RAVEN_TENANT_CONFIG : undefined;
}
