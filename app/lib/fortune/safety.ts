export type SafetyCheck = {
  isHighRisk: boolean;
  category?: "self_harm" | "medical" | "legal" | "financial" | "violence" | "spiritual_fear";
  message?: string;
};

const highRiskPatterns: Array<{ category: NonNullable<SafetyCheck["category"]>; patterns: RegExp[] }> = [
  { category: "self_harm", patterns: [/死にたい/, /消えたい/, /自殺/, /自傷/, /生きていたくない/] },
  { category: "medical", patterns: [/病気/, /診断/, /薬/, /治療/, /妊娠/, /手術/, /医者/, /癌|がん/] },
  { category: "legal", patterns: [/訴訟/, /裁判/, /逮捕/, /慰謝料/, /契約書/, /法律/, /弁護士/] },
  { category: "financial", patterns: [/投資/, /株/, /FX/, /借金/, /破産/, /仮想通貨/, /融資/] },
  { category: "violence", patterns: [/殴る/, /殴ら/, /暴力/, /DV/, /脅迫/, /逃げたい/, /殺され/] },
  { category: "spiritual_fear", patterns: [/呪い/, /霊障/, /悪霊/, /祟り/, /取り憑/] },
];

export function checkFortuneSafety(text: string): SafetyCheck {
  const normalized = text.trim();
  if (!normalized) return { isHighRisk: false };

  for (const item of highRiskPatterns) {
    if (item.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        isHighRisk: true,
        category: item.category,
        message:
          "この相談は、占いだけで判断しないほうがよい内容を含んでいます。レイヴン・ブラックウッドとして断定は避けます。まず安全を確保し、医療・法律・お金・身の危険に関わることは専門家や信頼できる人に相談してください。今日できる一歩は、ひとりで抱えず、状況を事実として短く書き出して誰かに共有することです。",
      };
    }
  }

  return { isHighRisk: false };
}
