type Variant = { variant_id: string; name: string; kind: string };
type Measurement = { id: string; variant_id: string; metric_name: string; metric_role?: string; baseline_value?: number | null; measured_value?: number | null; sample_size?: number; availability?: string; measured_at?: string };
type Guardrail = { id: string; result: string; checked_at?: string };
export type ResultCandidate = {
  candidateResult: "WIN" | "LOSS" | "NEUTRAL" | "INCONCLUSIVE";
  stopRecommendation: "CONTINUE" | "STOP_RECOMMENDED" | "COMPLETE_RECOMMENDED";
  primaryMetric: string;
  controlValue: number | null;
  variantValue: number | null;
  absoluteDifference: number | null;
  relativeDifference: number | null;
  sampleSize: number;
  confidence: number;
  guardrailStatus: "PASS" | "WARNING" | "FAIL" | "UNKNOWN";
  reasons: string[];
  blockers: string[];
  sourceMeasurementIds: string[];
  measurementFingerprint: string;
  autoStop: false;
};
function clean(value: unknown, maxLength = 240) { return String(value ?? "").trim().slice(0, maxLength); }
function num(value: unknown) { return value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null; }
function key(value: unknown) { return clean(value, 120).toLowerCase().replace(/[\s-]+/g, "_"); }
function guardrailStatus(guardrails: Guardrail[], configured: string[]) {
  if (!configured.length) return "PASS" as const;
  if (!guardrails.length) return "UNKNOWN" as const;
  if (guardrails.some((item) => item.result === "FAIL")) return "FAIL" as const;
  if (guardrails.some((item) => item.result === "UNKNOWN")) return "UNKNOWN" as const;
  if (guardrails.some((item) => item.result === "WARNING")) return "WARNING" as const;
  return "PASS" as const;
}
function fingerprint(measurements: Measurement[], guardrails: Guardrail[]) { return JSON.stringify({ measurements: measurements.map((item) => `${item.id}:${item.measured_at || ""}`).sort(), guardrails: guardrails.map((item) => `${item.id}:${item.checked_at || ""}:${item.result}`).sort() }); }

export function evaluateResultCandidate(input: { experimentId: string; runId: string; primaryMetric: string; direction?: string; variants: Variant[]; measurements: Measurement[]; guardrails: Guardrail[]; configuredGuardrails?: string[]; minimumSampleSize?: number; minimumRelativeLift?: number; minimumAbsoluteLift?: number }): ResultCandidate {
  const controls = input.variants.filter((item) => item.kind === "CONTROL");
  const alternatives = input.variants.filter((item) => item.kind === "VARIANT");
  const primaryKey = key(input.primaryMetric);
  const rows = input.measurements.filter((item) => item.metric_role === "primary" && key(item.metric_name) === primaryKey);
  const control = controls.map((item) => rows.filter((row) => row.variant_id === item.variant_id).sort((a, b) => Date.parse(String(b.measured_at || "")) - Date.parse(String(a.measured_at || "")))[0]).find(Boolean) || null;
  const variant = alternatives.map((item) => rows.filter((row) => row.variant_id === item.variant_id).sort((a, b) => Date.parse(String(b.measured_at || "")) - Date.parse(String(a.measured_at || "")))[0]).find(Boolean) || null;
  const guardrail = guardrailStatus(input.guardrails, input.configuredGuardrails || []);
  const blockers: string[] = [];
  const reasons: string[] = [];
  if (!control || !variant) blockers.push("Control and Variant measurements are required.");
  if (control && control.availability !== "AVAILABLE") blockers.push(`Control measurement is ${control.availability || "UNAVAILABLE"}.`);
  if (variant && variant.availability !== "AVAILABLE") blockers.push(`Variant measurement is ${variant.availability || "UNAVAILABLE"}.`);
  if (control?.baseline_value === null || control?.baseline_value === undefined || variant?.baseline_value === null || variant?.baseline_value === undefined) blockers.push("Baseline measurement is required.");
  const sampleSize = Math.min(Number(control?.sample_size || 0), Number(variant?.sample_size || 0));
  const minimumSampleSize = Math.max(1, Number(input.minimumSampleSize || 30));
  if (sampleSize < minimumSampleSize) blockers.push(`Sample size is insufficient (${sampleSize}/${minimumSampleSize}).`);
  if (guardrail === "UNKNOWN") blockers.push("Guardrail result is UNKNOWN.");
  const controlValue = num(control?.measured_value); const variantValue = num(variant?.measured_value);
  if (controlValue === null || variantValue === null) blockers.push("Current KPI measurement is unavailable.");
  const rawDifference = controlValue !== null && variantValue !== null ? variantValue - controlValue : null;
  const absoluteDifference = rawDifference === null ? null : Math.round(rawDifference * 10000) / 10000;
  const relativeDifference = rawDifference !== null && controlValue !== 0 ? Math.round((rawDifference / Math.abs(controlValue)) * 10000) / 100 : null;
  if (relativeDifference === null && rawDifference !== null) reasons.push("Relative change is unavailable because the Control value is zero.");
  const direction = clean(input.direction, 40).toLowerCase() === "decrease" ? "decrease" : "increase";
  const practicalLift = rawDifference === null ? null : direction === "increase" ? rawDifference : -rawDifference;
  const practicalRelative = relativeDifference === null ? null : direction === "increase" ? relativeDifference : -relativeDifference;
  const minimumRelativeLift = Math.max(0, Number(input.minimumRelativeLift ?? 0.05));
  const minimumAbsoluteLift = Math.max(0, Number(input.minimumAbsoluteLift ?? 0));
  const meaningful = practicalLift !== null && ((minimumAbsoluteLift > 0 && practicalLift >= minimumAbsoluteLift) || (minimumRelativeLift > 0 && practicalRelative !== null && practicalRelative >= minimumRelativeLift * 100));
  const meaningfulLoss = practicalLift !== null && ((minimumAbsoluteLift > 0 && practicalLift <= -minimumAbsoluteLift) || (minimumRelativeLift > 0 && practicalRelative !== null && practicalRelative <= -minimumRelativeLift * 100));
  let candidateResult: ResultCandidate["candidateResult"] = "INCONCLUSIVE";
  let stopRecommendation: ResultCandidate["stopRecommendation"] = "CONTINUE";
  if (!blockers.length) {
    if (guardrail === "FAIL") { candidateResult = "LOSS"; stopRecommendation = "STOP_RECOMMENDED"; reasons.push("A Guardrail FAIL was detected; automatic stop is not performed."); }
    else if (meaningful) { candidateResult = "WIN"; stopRecommendation = "COMPLETE_RECOMMENDED"; reasons.push("Variant met the configured practical improvement threshold."); }
    else if (meaningfulLoss) { candidateResult = "LOSS"; stopRecommendation = "COMPLETE_RECOMMENDED"; reasons.push("Variant missed the configured practical threshold in the adverse direction."); }
    else { candidateResult = "NEUTRAL"; stopRecommendation = "COMPLETE_RECOMMENDED"; reasons.push("The Control / Variant difference is below the configured practical threshold."); }
  }
  if (blockers.length) reasons.push("Result remains INCONCLUSIVE until blocking data conditions are resolved.");
  return { candidateResult, stopRecommendation, primaryMetric: input.primaryMetric, controlValue, variantValue, absoluteDifference, relativeDifference, sampleSize, confidence: Math.min(0.99, sampleSize / (minimumSampleSize * 2)), guardrailStatus: guardrail, reasons, blockers, sourceMeasurementIds: [...(control ? [control.id] : []), ...(variant ? [variant.id] : [])], measurementFingerprint: fingerprint(input.measurements, input.guardrails), autoStop: false };
}
