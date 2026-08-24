const LOCALE_COOKIE = "raven_locale";
const LOCALE_COOKIE_MAX_AGE = 31536000;

function localeCookie(locale: "ja" | "en") {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function redirect(location: string, locale: "ja" | "en", vary = false) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Set-Cookie": localeCookie(locale),
      ...(vary ? { Vary: "Accept-Language, Cookie" } : {}),
    },
  });
}

export function englishEntryRedirect(request: Request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.pathname !== "/" && url.pathname !== "") return null;

  const explicit = url.searchParams.get("lang");
  if (explicit === "ja") {
    url.searchParams.delete("lang");
    return redirect(url.toString(), "ja");
  }
  if (explicit === "en") return redirect("/en/", "en");

  const cookie = request.headers.get("cookie") || "";
  const savedLocale = new RegExp(`\\b${LOCALE_COOKIE}=(ja|en)\\b`, "i").exec(cookie)?.[1]?.toLowerCase();
  if (savedLocale === "en") return redirect("/en/", "en");
  if (savedLocale === "ja") return null;

  const language = (request.headers.get("accept-language") || "").toLowerCase();
  const english = /(^|,|;)\s*en(?:[-_][a-z]{2})?(?:\s*;\s*q=([0-9.]+))?/.exec(language);
  const japanese = /(^|,|;)\s*ja(?:[-_][a-z]{2})?(?:\s*;\s*q=([0-9.]+))?/.exec(language);
  const quality = (match: RegExpExecArray | null) => match?.[2] ? Number(match[2]) : match ? 1 : 0;

  if (quality(english) > quality(japanese)) return redirect("/en/", "en", true);
  return null;
}
