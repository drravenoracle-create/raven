import { buildCalendarBlog, buildCalendarSocial, buildDailyAlmanac } from "@/app/lib/calendar/daily-almanac";

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatFor(date: string, value: string | null) {
  if (value === "short_video" || value === "carousel") return value;
  return Number(date.replace(/-/g, "")) % 2 ? "short_video" : "carousel";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localDate = url.searchParams.get("date") || todayJst();
  const format = formatFor(localDate, url.searchParams.get("format"));
  try {
    const almanac = buildDailyAlmanac(localDate);
    return Response.json({ ok: true, localDate, almanac, blog: buildCalendarBlog(almanac), social: buildCalendarSocial(almanac, format), format }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Invalid calendar date" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
