import { tenantConfigResolver } from "./tenant-config-resolver.ts";
import type { EntitlementValue, TenantConfig } from "./studioos-tenant-config.ts";

export type PlanId = "LIGHT" | "STANDARD" | "PREMIUM" | "BUSINESS" | "ENTERPRISE";
export type FeatureKey = "analytics" | "blog" | "content" | "sns" | "reel" | "growth" | "openingCampaign" | "advancedAnalytics" | "experiment" | "strategy" | "sales" | "retention" | "operations" | "finance" | string;
export type DecisionSource = "plan" | "flag" | "override";

export type FeatureDecision = {
  feature: string;
  allowed: boolean;
  source: DecisionSource;
  reason: string;
  planDefault: boolean;
  featureFlag: boolean | null;
  tenantOverride: EntitlementValue;
};

const PLAN_DEFAULTS: Record<PlanId, Readonly<Record<string, boolean>>> = {
  LIGHT: { analytics: true, blog: false, content: false, sns: false, reel: false, growth: false, openingCampaign: false, advancedAnalytics: false, experiment: false, strategy: false },
  STANDARD: { analytics: true, blog: true, content: true, sns: true, reel: true, growth: false, openingCampaign: true, advancedAnalytics: false, experiment: false, strategy: false },
  PREMIUM: { analytics: true, blog: true, content: true, sns: true, reel: true, growth: true, openingCampaign: true, advancedAnalytics: true, experiment: true, strategy: true },
  BUSINESS: { analytics: true, blog: true, content: true, sns: true, reel: true, growth: true, openingCampaign: true, advancedAnalytics: true, experiment: true, strategy: true, sales: true, retention: true },
  ENTERPRISE: { analytics: true, blog: true, content: true, sns: true, reel: true, growth: true, openingCampaign: true, advancedAnalytics: true, experiment: true, strategy: true, sales: true, retention: true, operations: true, finance: true },
};

function planOf(config: TenantConfig): PlanId {
  const plan = String(config.plan.planId || "PREMIUM").toUpperCase() as PlanId;
  return plan in PLAN_DEFAULTS ? plan : "PREMIUM";
}

export class FeatureEntitlementResolver {
  private readonly resolver: Pick<typeof tenantConfigResolver, "requireTenantConfig">;

  constructor(resolver = tenantConfigResolver) {
    this.resolver = resolver;
  }

  resolveFeature(tenantId: string, featureKey: FeatureKey): FeatureDecision {
    const config = this.resolver.requireTenantConfig(tenantId);
    const feature = String(featureKey);
    const planDefault = Boolean(PLAN_DEFAULTS[planOf(config)][feature]);
    const flags = config.entitlements.featureFlags || {};
    const overrides = config.entitlements.tenantOverrides || {};
    const flag = Object.prototype.hasOwnProperty.call(flags, feature) ? Boolean(flags[feature]) : null;
    const override = overrides[feature] || "inherit";

    if (override === "deny") return { feature, allowed: false, source: "override", reason: "tenant_override_denied", planDefault, featureFlag: flag, tenantOverride: override };
    if (flag === false) return { feature, allowed: false, source: "flag", reason: "feature_flag_off", planDefault, featureFlag: flag, tenantOverride: override };
    if (override === "allow" && planDefault) return { feature, allowed: true, source: "override", reason: "tenant_override_allowed", planDefault, featureFlag: flag, tenantOverride: override };
    if (override === "allow" && !planDefault) return { feature, allowed: false, source: "plan", reason: "plan_does_not_include_feature", planDefault, featureFlag: flag, tenantOverride: override };
    return { feature, allowed: planDefault, source: "plan", reason: planDefault ? "plan_default_allowed" : "plan_does_not_include_feature", planDefault, featureFlag: flag, tenantOverride: override };
  }

  resolveAllFeatures(tenantId: string): FeatureDecision[] {
    return ["analytics", "blog", "content", "sns", "reel", "growth", "openingCampaign", "advancedAnalytics", "experiment", "strategy"].map((feature) => this.resolveFeature(tenantId, feature));
  }
}

export const featureEntitlementResolver = new FeatureEntitlementResolver();
export const resolveFeature = (tenantId: string, featureKey: FeatureKey) => featureEntitlementResolver.resolveFeature(tenantId, featureKey);
export const resolveAllFeatures = (tenantId: string) => featureEntitlementResolver.resolveAllFeatures(tenantId);
export { PLAN_DEFAULTS };
