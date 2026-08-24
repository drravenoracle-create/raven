export type PreflightDecision = "START_ALLOWED" | "START_BLOCKED" | "REQUIRE_APPROVAL" | "GUARDRAIL_FAILED" | "INVALID_STATE";

export type PreflightPolicyInput = {
  status: string;
  approvalRequired: boolean;
  approved: boolean;
  evidenceDecision: string;
  evidenceSufficiency: string;
  scopeMatch: boolean;
  characterMatch: boolean;
  killSwitchEnabled: boolean;
  guardrailEvaluated: boolean;
  guardrailPassed: boolean;
  reversible: boolean;
  rollbackPlan: boolean;
  requireStartState?: boolean;
};

export function evaluatePreflightPolicy(input: PreflightPolicyInput) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const status = String(input.status || "").toUpperCase();
  const terminal = new Set(["RUNNING", "MEASURING", "COMPLETED", "REJECTED", "CANCELLED", "ARCHIVED"]);
  if (input.requireStartState && status !== "APPROVED") blockers.push(status === "REJECTED" ? "Experiment is rejected." : `Experiment status ${status || "UNKNOWN"} is not startable.`);
  if (terminal.has(status)) blockers.push(status === "RUNNING" || status === "MEASURING" ? "Experiment is already active." : "Experiment is already finished or closed.");
  if (!input.scopeMatch) blockers.push("Experiment scope does not match the requested scope.");
  if (!input.characterMatch) blockers.push("Experiment character does not match the requested character.");
  if (input.approvalRequired && !input.approved) blockers.push("Human Approval is required.");
  if (input.evidenceDecision !== "GO" || input.evidenceSufficiency === "INSUFFICIENT") blockers.push(`Evidence does not allow start: ${input.evidenceDecision || "UNKNOWN"}.`);
  if (!input.guardrailEvaluated) blockers.push("Guardrail has not been evaluated.");
  if (input.guardrailEvaluated && !input.guardrailPassed) blockers.push("Guardrail evaluation failed.");
  if (input.killSwitchEnabled) blockers.push("Kill switch is enabled.");
  if (!input.reversible && !input.rollbackPlan) blockers.push("Rollback plan is required for an irreversible Experiment.");
  if (input.evidenceSufficiency === "WEAK" || input.evidenceSufficiency === "MODERATE") warnings.push(`Evidence sufficiency is ${input.evidenceSufficiency}.`);
  if (input.approvalRequired && !input.approved) return { allowed: false, decision: "REQUIRE_APPROVAL" as PreflightDecision, blockers, warnings };
  if (status !== "APPROVED" && input.requireStartState) return { allowed: false, decision: "INVALID_STATE" as PreflightDecision, blockers, warnings };
  if (input.killSwitchEnabled || (input.guardrailEvaluated && !input.guardrailPassed) || !input.guardrailEvaluated) return { allowed: false, decision: "GUARDRAIL_FAILED" as PreflightDecision, blockers, warnings };
  if (blockers.length) return { allowed: false, decision: "START_BLOCKED" as PreflightDecision, blockers, warnings };
  return { allowed: true, decision: "START_ALLOWED" as PreflightDecision, blockers, warnings };
}
