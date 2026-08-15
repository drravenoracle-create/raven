import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import {
  CARD_LIBRARY_TENANT_ID,
  createCard,
  createDeck,
  deleteCard,
  getCard,
  getCardUsageHistory,
  getDeck,
  listCards,
  listDecks,
  recordCardUsage,
  selectCards,
  updateCard,
  updateDeck,
} from "@/app/lib/card-library";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

async function requireApiAdmin() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) {
    return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  }
  return null;
}

function assertTenant(value: unknown) {
  const tenantId = clean(value, 80) || CARD_LIBRARY_TENANT_ID;
  if (tenantId !== CARD_LIBRARY_TENANT_ID) throw new Error("Invalid tenant_id.");
  return tenantId;
}

export async function GET(request: Request) {
  const denied = await requireApiAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  let tenantId = CARD_LIBRARY_TENANT_ID;
  try {
    tenantId = assertTenant(url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id"));
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  }

  const resource = clean(url.searchParams.get("resource"), 40) || "overview";
  try {
    if (resource === "decks") return Response.json({ ok: true, decks: await listDecks(env.DB, tenantId) }, { headers: { "Cache-Control": "no-store" } });
    if (resource === "deck") {
      const deck = await getDeck(env.DB, clean(url.searchParams.get("id"), 120), tenantId);
      return deck ? Response.json({ ok: true, deck }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ ok: false, error: "Deck not found." }, { status: 404 });
    }
    if (resource === "cards") {
      const cards = await listCards(env.DB, {
        deckId: clean(url.searchParams.get("deckId") ?? url.searchParams.get("deck_id"), 120),
        q: clean(url.searchParams.get("q"), 120),
        enabled: clean(url.searchParams.get("enabled"), 20) || "all",
        tag: clean(url.searchParams.get("tag"), 80),
      }, tenantId);
      return Response.json({ ok: true, cards }, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "card") {
      const card = await getCard(env.DB, clean(url.searchParams.get("id"), 120), tenantId);
      return card ? Response.json({ ok: true, card }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ ok: false, error: "Card not found." }, { status: 404 });
    }
    if (resource === "usage") {
      const usage = await getCardUsageHistory(env.DB, {
        deckId: clean(url.searchParams.get("deckId") ?? url.searchParams.get("deck_id"), 120),
        cardId: clean(url.searchParams.get("cardId") ?? url.searchParams.get("card_id"), 120),
      }, tenantId);
      return Response.json({ ok: true, usage }, { headers: { "Cache-Control": "no-store" } });
    }

    const [decks, cards, usage] = await Promise.all([
      listDecks(env.DB, tenantId),
      listCards(env.DB, { enabled: "all" }, tenantId),
      getCardUsageHistory(env.DB, {}, tenantId),
    ]);
    return Response.json({ ok: true, decks, cards, usage }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Card Library API failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireApiAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  let tenantId = CARD_LIBRARY_TENANT_ID;
  try {
    tenantId = assertTenant(body.tenant_id ?? body.tenantId);
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  }

  try {
    const action = clean(body.action, 40);
    if (action === "createDeck") return Response.json({ ok: true, deck: await createDeck(env.DB, body, tenantId) }, { status: 201 });
    if (action === "updateDeck") return Response.json({ ok: true, deck: await updateDeck(env.DB, body, tenantId) });
    if (action === "archiveDeck") return Response.json({ ok: true, deck: await updateDeck(env.DB, { ...body, status: "archived" }, tenantId) });
    if (action === "createCard") return Response.json({ ok: true, card: await createCard(env.DB, body, tenantId) }, { status: 201 });
    if (action === "updateCard") return Response.json({ ok: true, card: await updateCard(env.DB, body, tenantId) });
    if (action === "deleteCard") return Response.json({ ok: true, deleted: await deleteCard(env.DB, body, tenantId) });
    if (action === "selectCards") return Response.json({ ok: true, selection: await selectCards(env.DB, body, tenantId) });
    if (action === "recordUsage") {
      const cards = Array.isArray(body.cards) ? body.cards as { id: string; deck_id: string }[] : [];
      await recordCardUsage(env.DB, {
        cards,
        contentType: clean(body.content_type ?? body.contentType, 80),
        snsPlatform: clean(body.sns_platform ?? body.snsPlatform, 80),
        postId: clean(body.post_id ?? body.postId, 120),
        contentId: clean(body.content_id ?? body.contentId, 120),
        selectionMode: clean(body.selection_mode ?? body.selectionMode, 80),
      }, tenantId);
      return Response.json({ ok: true, recorded: cards.length });
    }
    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Card Library action failed." }, { status: 400 });
  }
}
