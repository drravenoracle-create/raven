export type SexagenaryDay = {
  index: number;
  name: string;
  reading: string;
  heavenlyStem: string;
  earthlyBranch: string;
  element: string;
  polarity: string;
  basicTheme: string;
  actionKeywords: string[];
  loveTheme: string;
  workTheme: string;
  moneyTheme: string;
  caution: string;
  message: string;
};

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const STEM_READINGS = ["かのえ", "きのと", "ひのえ", "ひのと", "つちのえ", "つちのと", "かのえ", "かのと", "みずのえ", "みずのと"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const BRANCH_READINGS = ["ね", "うし", "とら", "う", "たつ", "み", "うま", "ひつじ", "さる", "とり", "いぬ", "い"];
const ELEMENTS = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"];
const POLARITIES = ["陽", "陰", "陽", "陰", "陽", "陰", "陽", "陰", "陽", "陰"];

// 2026-08-21 is 丁卯日 (index 3) in the verified reference calendar.
// Keep the reference explicit so the calculation remains deterministic and auditable.
export const SEXAGENARY_REFERENCE = { localDate: "2026-08-21", index: 3 } as const;

const THEMES = [
  ["始まり", "小さく始める", "率直な会話", "先頭に立つ", "準備を整える", "急いで結論を出さない", "一歩目を静かに選ぶ"],
  ["育てる", "手をかける", "安心を伝える", "継続を優先する", "堅実に守る", "抱え込みすぎない", "続ける力が流れを育てる"],
  ["動き", "先に試す", "気持ちを言葉にする", "決断を先送りしない", "機会を見極める", "勢いだけで進まない", "動きながら整えていく"],
  ["調和", "相手の話を聞く", "距離感を整える", "協力者を頼る", "条件を確認する", "曖昧な約束を残さない", "整った言葉が次の扉を開く"],
  ["変化", "不要なものを手放す", "本音を一つ伝える", "優先順位を変える", "見直しに投資する", "古い不安に戻らない", "変化は選び直しから始まる"],
  ["知恵", "記録を残す", "結論を急がない", "情報を比べる", "数字を確認する", "思い込みで決めない", "見えた事実が判断を支える"],
];

function dayIndex(localDate: string) {
  const target = new Date(`${localDate}T00:00:00Z`);
  const reference = new Date(`${SEXAGENARY_REFERENCE.localDate}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) throw new Error("Invalid local date");
  return (SEXAGENARY_REFERENCE.index + Math.round((target.getTime() - reference.getTime()) / 86_400_000) % 60 + 60) % 60;
}

export function getSexagenaryDay(localDate: string): SexagenaryDay {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("localDate must be YYYY-MM-DD");
  const index = dayIndex(localDate);
  const stemIndex = index % 10;
  const branchIndex = index % 12;
  const theme = THEMES[index % THEMES.length];
  return {
    index,
    name: `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`,
    reading: `${STEM_READINGS[stemIndex]}${BRANCH_READINGS[branchIndex]}`,
    heavenlyStem: STEMS[stemIndex],
    earthlyBranch: BRANCHES[branchIndex],
    element: ELEMENTS[stemIndex],
    polarity: POLARITIES[stemIndex],
    basicTheme: theme[0],
    actionKeywords: [theme[1], theme[2]],
    loveTheme: theme[2],
    workTheme: theme[3],
    moneyTheme: theme[4],
    caution: theme[5],
    message: theme[6],
  };
}

export function getSexagenaryCycle() {
  return Array.from({ length: 60 }, (_, index) => getSexagenaryDay(
    new Date(Date.UTC(2026, 7, 21 + index)).toISOString().slice(0, 10),
  ));
}
