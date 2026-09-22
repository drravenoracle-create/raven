import { env } from "cloudflare:workers";
import { getTenantConfig } from "@/app/lib/tenant-config";
import { adminEmail, getAdminSession } from "@/app/lib/google-admin-auth";

export function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function tenantFrom(value: unknown) {
  const tenantId = text(value, 80);
  if (!tenantId || !getTenantConfig(tenantId)) throw new Error("tenantId is required and must be a known tenant.");
  return tenantId;
}

export function jsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function requireEvidenceAdmin() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) throw new Error("Admin authentication required.");
  return session;
}

export { env };
