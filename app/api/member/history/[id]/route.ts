import { env } from "cloudflare:workers";
import { getReadingDetail, guildMemberErrorResponse, guildMemberFlags } from "@/app/lib/guild-member-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const flags = guildMemberFlags(env);
  if (!flags.member_system_enabled || !flags.configured || !flags.reading_history_enabled) {
    return Response.json(
      { ok: false, error: "Reading history is not available.", code: "reading_history_unavailable", flags },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { id } = await params;
    return Response.json(await getReadingDetail(env, request, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return guildMemberErrorResponse(error);
  }
}
