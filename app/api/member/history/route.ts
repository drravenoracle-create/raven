import { env } from "cloudflare:workers";
import { getReadingHistory, guildMemberErrorResponse, guildMemberFlags } from "@/app/lib/guild-member-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const flags = guildMemberFlags(env);
  if (!flags.member_system_enabled || !flags.configured || !flags.reading_history_enabled) {
    return Response.json(
      { ok: false, error: "Reading history is not available.", code: "reading_history_unavailable", flags },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const url = new URL(request.url);
    return Response.json(await getReadingHistory(env, request, url.searchParams.toString()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return guildMemberErrorResponse(error);
  }
}
