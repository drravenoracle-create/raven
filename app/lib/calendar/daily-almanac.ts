import { getSexagenaryDay, type SexagenaryDay } from "./sexagenary.ts";

export type DailyAlmanacData = {
  tenantId: string;
  localDate: string;
  contentType: "daily_calendar";
  sexagenary: SexagenaryDay;
  character: { name: string; voice: string };
  theme: string;
  recommendedAction: string;
  love: string;
  work: string;
  money: string;
  caution: string;
  message: string;
  rokuyo: { name: string; reading: string; note: string };
};

const ROKUYO_BY_DATE: Record<string, DailyAlmanacData["rokuyo"]> = {
  "2026-08-24": { name: "赤口", reading: "しゃっこう", note: "正午前後（11時〜13時）以外は凶とされる日。急いで結論を出さず、火や刃物にも注意します。" },
};

function rokuyoFor(localDate: string) {
  return ROKUYO_BY_DATE[localDate] || { name: "六曜", reading: "ろくよう", note: "六曜は旧暦の日付に基づいて読みます。" };
}

export function buildDailyAlmanac(localDate: string, tenantId = "raven-oracle"): DailyAlmanacData {
  const sexagenary = getSexagenaryDay(localDate);
  return {
    tenantId,
    localDate,
    contentType: "daily_calendar",
    sexagenary,
    character: { name: "レイヴン・ブラックウッド", voice: "静かで知的、断定せず判断軸を整える" },
    theme: sexagenary.basicTheme,
    recommendedAction: sexagenary.actionKeywords[0],
    love: sexagenary.loveTheme,
    work: sexagenary.workTheme,
    money: sexagenary.moneyTheme,
    caution: sexagenary.caution,
    message: sexagenary.message,
    rokuyo: rokuyoFor(localDate),
  };
}

export function buildCalendarBlog(almanac: DailyAlmanacData) {
  const { localDate, sexagenary: day } = almanac;
  const [year, month, date] = localDate.split("-");
  return {
    title: `今日の暦｜${year}年${Number(month)}月${Number(date)}日｜${day.name}の日`,
    slug: `daily-calendar-${localDate}`,
    description: `${localDate}の今日の暦。${day.name}の日のテーマと、仕事・恋愛・金運の行動ヒントを紹介します。`,
    category: "今日の暦",
    body: [
      `## 今日の日干支：${day.name}（${day.reading}）`,
      `## 六曜：${almanac.rokuyo.name}（${almanac.rokuyo.reading}）\n${almanac.rokuyo.note}`,
      `${day.name}は、${day.element}の${day.polarity}の性質を持つ日として読みます。暦は未来を断定するものではなく、今日の行動を考えるための読み物です。`,
      `## 今日のテーマ：${almanac.theme}`,
      `今日は「${almanac.recommendedAction}」を意識すると、状況を落ち着いて動かせます。`,
      `## 恋愛運\n${almanac.love}`,
      `## 仕事運\n${almanac.work}`,
      `## 金運\n${almanac.money}`,
      `## 注意したいこと\n${almanac.caution}。急いで答えを固定せず、確認できることから整えましょう。`,
      `## 今日の一言\n${almanac.message}`,
      "## 関連ページ\nより具体的に整理したい場合は、[AI無料占い](/free-fortune/)や[AIテキスト鑑定](/text-reading/)もご利用ください。",
    ].join("\n\n"),
    keyMessage: almanac.message,
    tags: ["今日の暦", day.name, "レイヴン・ブラックウッド", "Fortune Studio"],
  };
}

export function buildCalendarSocial(almanac: DailyAlmanacData, format: "short_video" | "carousel") {
  const day = almanac.sexagenary;
  const caption = [`今日の暦｜${day.name}（${day.reading}）の日`, `六曜：${almanac.rokuyo.name}（${almanac.rokuyo.reading}）`, `テーマ：${almanac.theme}`, `おすすめ：${almanac.recommendedAction}`, `注意：${almanac.caution}`, almanac.message, "#レイヴンブラックウッド #今日の暦 #六曜 #干支 #占い"].join("\n\n");
  if (format === "short_video") return { postType: "reel", mediaType: "video", script: [`0-3秒：今日の暦｜${almanac.localDate}`, `3-7秒：${day.name}の日`, `7-12秒：テーマ ${almanac.theme}`, `12-17秒：${almanac.recommendedAction} / ${almanac.caution}`, `17-20秒：${almanac.message}`].join("\n"), caption };
  return { postType: "carousel", mediaType: "image", script: [`1枚目：${almanac.localDate} 今日の暦｜${day.name}（${day.reading}）の日`, `2枚目：六曜 ${almanac.rokuyo.name}（${almanac.rokuyo.reading}）`, `3枚目：${almanac.theme} / ${day.basicTheme}`, `4枚目：仕事 ${almanac.work} / 金運 ${almanac.money}`, `5枚目：恋愛 ${almanac.love} / 注意 ${almanac.caution}`, `6枚目：${almanac.message} / レイヴン・ブラックウッド`].join("\n"), caption };
}
