export type SnsDuplicateCandidate = {
  id: string;
  title?: string;
  theme?: string;
  caption?: string;
  script?: string;
  duplicate_warning?: string;
  created_at?: string;
};

const stopWords = new Set(["です", "ます", "する", "した", "して", "こと", "ため", "よう", "Raven", "Blackwood", "RavenBlackwood"]);

export function normalizeSnsText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#[\p{L}\p{N}_ー-]+/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fingerprintSnsContent(input: { title?: unknown; theme?: unknown; caption?: unknown; script?: unknown }) {
  const normalized = normalizeSnsText([input.title, input.theme, input.caption, input.script].filter(Boolean).join(" "));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export function tokenizeSnsContent(value: unknown) {
  const normalized = normalizeSnsText(value);
  const tokens = new Set<string>();
  for (const token of normalized.split(" ")) {
    if (token.length >= 2 && !stopWords.has(token)) tokens.add(token);
  }
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const pair = normalized.slice(index, index + 2).trim();
    if (pair.length === 2 && !/\s/.test(pair)) tokens.add(pair);
  }
  return tokens;
}

export function similarityScore(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}

export function findSnsDuplicate(
  input: { title?: unknown; theme?: unknown; caption?: unknown; script?: unknown; fingerprint?: string },
  candidates: SnsDuplicateCandidate[],
  threshold = 0.72,
) {
  const currentText = [input.title, input.theme, input.caption, input.script].filter(Boolean).join(" ");
  const currentTokens = tokenizeSnsContent(currentText);
  let best: { candidate: SnsDuplicateCandidate; score: number; reason: "fingerprint" | "similarity" } | null = null;

  for (const candidate of candidates) {
    if (input.fingerprint && candidate.duplicate_warning === `fingerprint:${input.fingerprint}`) {
      return { candidate, score: 1, reason: "fingerprint" as const };
    }
    const candidateText = [candidate.title, candidate.theme, candidate.caption, candidate.script].filter(Boolean).join(" ");
    const score = similarityScore(currentTokens, tokenizeSnsContent(candidateText));
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate, score, reason: "similarity" };
    }
  }
  return best;
}
