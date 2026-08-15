export const CARD_LIBRARY_TENANT_ID = "raven-oracle";

export type DeckStatus = "draft" | "active" | "archived";
export type DeckType = "tarot" | "lenormand" | "oracle" | "other";
export type SelectionMode = "random" | "least_used";

export type CardLibraryDeck = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  deck_type: DeckType;
  description: string;
  card_count: number;
  back_image_url: string;
  storage_provider: string;
  storage_key: string;
  copyright_status: string;
  commercial_use_allowed: number;
  sns_use_allowed: number;
  status: DeckStatus;
  created_at: string;
  updated_at: string;
};

export type CardLibraryCard = {
  id: string;
  tenant_id: string;
  deck_id: string;
  card_number: number;
  name: string;
  name_ja: string;
  image_url: string;
  storage_provider: string;
  storage_key: string;
  upright_meaning: string;
  reversed_meaning: string;
  love_meaning: string;
  work_meaning: string;
  money_meaning: string;
  keywords_json: string;
  tags_json: string;
  sns_summary: string;
  sns_use_allowed: number;
  enabled: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  usage_count?: number;
};

export type SelectedCard = CardLibraryCard & {
  deck_name?: string;
  keywords: string[];
  tags: string[];
};

type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠ー]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || `deck-${Date.now()}`;
}

function toJsonList(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => clean(item, 80)).filter(Boolean));
  return JSON.stringify(clean(value, 500).split(",").map((item) => item.trim()).filter(Boolean));
}

export function parseJsonList(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function decorateCard(card: CardLibraryCard): SelectedCard {
  return { ...card, keywords: parseJsonList(card.keywords_json), tags: parseJsonList(card.tags_json) };
}

export function selectCardCandidates(cards: CardLibraryCard[], count: number, mode: SelectionMode) {
  const pool = [...cards];
  if (mode === "least_used") {
    pool.sort((a, b) => Number(a.usage_count || 0) - Number(b.usage_count || 0) || a.sort_order - b.sort_order || a.card_number - b.card_number);
    return pool.slice(0, Math.max(1, count));
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, count));
}

export async function listDecks(db: D1, tenantId = CARD_LIBRARY_TENANT_ID) {
  const result = await db.prepare(
    `SELECT d.*, COUNT(c.id) AS registered_cards
      FROM card_library_decks d
      LEFT JOIN card_library_cards c ON c.tenant_id = d.tenant_id AND c.deck_id = d.id
      WHERE d.tenant_id = ?
      GROUP BY d.id
      ORDER BY datetime(d.updated_at) DESC`,
  ).bind(tenantId).all<CardLibraryDeck & { registered_cards: number }>();
  return result.results || [];
}

export async function getDeck(db: D1, id: string, tenantId = CARD_LIBRARY_TENANT_ID) {
  return db.prepare("SELECT * FROM card_library_decks WHERE tenant_id = ? AND id = ? LIMIT 1").bind(tenantId, id).first<CardLibraryDeck>();
}

export async function createDeck(db: D1, input: Record<string, unknown>, tenantId = CARD_LIBRARY_TENANT_ID) {
  const id = crypto.randomUUID();
  const name = clean(input.name, 180);
  if (!name) throw new Error("デッキ名は必須です。");
  const slug = slugify(clean(input.slug, 140) || name);
  await db.prepare(
    `INSERT INTO card_library_decks
      (id, tenant_id, name, slug, deck_type, description, card_count, back_image_url, storage_provider, storage_key, copyright_status, commercial_use_allowed, sns_use_allowed, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      tenantId,
      name,
      slug,
      clean(input.deck_type ?? input.deckType, 40) || "oracle",
      clean(input.description, 2000),
      Number(input.card_count ?? input.cardCount ?? 0) || 0,
      clean(input.back_image_url ?? input.backImageUrl, 1000),
      clean(input.storage_provider ?? input.storageProvider, 80) || "url",
      clean(input.storage_key ?? input.storageKey, 1000),
      clean(input.copyright_status ?? input.copyrightStatus, 120) || "owned",
      input.commercial_use_allowed === true || input.commercialUseAllowed === true ? 1 : 0,
      input.sns_use_allowed === true || input.snsUseAllowed === true ? 1 : 0,
      clean(input.status, 40) || "draft",
    )
    .run();
  return getDeck(db, id, tenantId);
}

export async function updateDeck(db: D1, input: Record<string, unknown>, tenantId = CARD_LIBRARY_TENANT_ID) {
  const id = clean(input.id, 120);
  if (!id) throw new Error("id is required.");
  const current = await getDeck(db, id, tenantId);
  if (!current) throw new Error("Deck not found.");
  const name = clean(input.name ?? current.name, 180);
  await db.prepare(
    `UPDATE card_library_decks
      SET name = ?, slug = ?, deck_type = ?, description = ?, card_count = ?, back_image_url = ?, storage_provider = ?, storage_key = ?,
          copyright_status = ?, commercial_use_allowed = ?, sns_use_allowed = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND id = ?`,
  )
    .bind(
      name,
      slugify(clean(input.slug ?? current.slug, 140) || name),
      clean(input.deck_type ?? input.deckType ?? current.deck_type, 40),
      clean(input.description ?? current.description, 2000),
      Number(input.card_count ?? input.cardCount ?? current.card_count) || 0,
      clean(input.back_image_url ?? input.backImageUrl ?? current.back_image_url, 1000),
      clean(input.storage_provider ?? input.storageProvider ?? current.storage_provider, 80) || "url",
      clean(input.storage_key ?? input.storageKey ?? current.storage_key, 1000),
      clean(input.copyright_status ?? input.copyrightStatus ?? current.copyright_status, 120) || "owned",
      input.commercial_use_allowed === true || input.commercialUseAllowed === true ? 1 : 0,
      input.sns_use_allowed === true || input.snsUseAllowed === true ? 1 : 0,
      clean(input.status ?? current.status, 40) || "draft",
      tenantId,
      id,
    )
    .run();
  return getDeck(db, id, tenantId);
}

export async function listCards(db: D1, input: { deckId?: string; q?: string; enabled?: string; tag?: string }, tenantId = CARD_LIBRARY_TENANT_ID) {
  const deckId = clean(input.deckId, 120);
  const q = `%${clean(input.q, 120)}%`;
  const enabled = clean(input.enabled, 20);
  const tag = clean(input.tag, 80);
  const result = await db.prepare(
    `SELECT c.*, COALESCE(u.usage_count, 0) AS usage_count
      FROM card_library_cards c
      LEFT JOIN (
        SELECT tenant_id, card_id, COUNT(*) AS usage_count
        FROM card_usage_history
        WHERE tenant_id = ?
        GROUP BY tenant_id, card_id
      ) u ON u.tenant_id = c.tenant_id AND u.card_id = c.id
      WHERE c.tenant_id = ?
        AND (? = '' OR c.deck_id = ?)
        AND (? = 'all' OR ? = '' OR c.enabled = CAST(? AS INTEGER))
        AND (? = '' OR c.name LIKE ? OR c.name_ja LIKE ?)
        AND (? = '' OR c.tags_json LIKE ?)
      ORDER BY c.sort_order ASC, c.card_number ASC, c.created_at ASC`,
  )
    .bind(tenantId, tenantId, deckId, deckId, enabled, enabled, enabled, clean(input.q, 120), q, q, tag, `%${tag}%`)
    .all<CardLibraryCard>();
  return (result.results || []).map(decorateCard);
}

export async function getCard(db: D1, id: string, tenantId = CARD_LIBRARY_TENANT_ID) {
  const card = await db.prepare("SELECT * FROM card_library_cards WHERE tenant_id = ? AND id = ? LIMIT 1").bind(tenantId, id).first<CardLibraryCard>();
  return card ? decorateCard(card) : null;
}

export async function createCard(db: D1, input: Record<string, unknown>, tenantId = CARD_LIBRARY_TENANT_ID) {
  const id = crypto.randomUUID();
  const deckId = clean(input.deck_id ?? input.deckId, 120);
  const name = clean(input.name, 180);
  if (!deckId || !name) throw new Error("deck_id and name are required.");
  const deck = await getDeck(db, deckId, tenantId);
  if (!deck) throw new Error("Deck not found.");
  await db.prepare(
    `INSERT INTO card_library_cards
      (id, tenant_id, deck_id, card_number, name, name_ja, image_url, storage_provider, storage_key, upright_meaning, reversed_meaning,
       love_meaning, work_meaning, money_meaning, keywords_json, tags_json, sns_summary, sns_use_allowed, enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      tenantId,
      deckId,
      Number(input.card_number ?? input.cardNumber ?? 0) || 0,
      name,
      clean(input.name_ja ?? input.nameJa, 180),
      clean(input.image_url ?? input.imageUrl, 1000),
      clean(input.storage_provider ?? input.storageProvider, 80) || "url",
      clean(input.storage_key ?? input.storageKey, 1000),
      clean(input.upright_meaning ?? input.uprightMeaning, 3000),
      clean(input.reversed_meaning ?? input.reversedMeaning, 3000),
      clean(input.love_meaning ?? input.loveMeaning, 2000),
      clean(input.work_meaning ?? input.workMeaning, 2000),
      clean(input.money_meaning ?? input.moneyMeaning, 2000),
      toJsonList(input.keywords),
      toJsonList(input.tags),
      clean(input.sns_summary ?? input.snsSummary, 500),
      input.sns_use_allowed === false || input.snsUseAllowed === false ? 0 : 1,
      input.enabled === false ? 0 : 1,
      Number(input.sort_order ?? input.sortOrder ?? input.card_number ?? 0) || 0,
    )
    .run();
  return getCard(db, id, tenantId);
}

export async function updateCard(db: D1, input: Record<string, unknown>, tenantId = CARD_LIBRARY_TENANT_ID) {
  const id = clean(input.id, 120);
  if (!id) throw new Error("id is required.");
  const current = await getCard(db, id, tenantId);
  if (!current) throw new Error("Card not found.");
  await db.prepare(
    `UPDATE card_library_cards
      SET card_number = ?, name = ?, name_ja = ?, image_url = ?, storage_provider = ?, storage_key = ?, upright_meaning = ?, reversed_meaning = ?,
          love_meaning = ?, work_meaning = ?, money_meaning = ?, keywords_json = ?, tags_json = ?, sns_summary = ?, sns_use_allowed = ?,
          enabled = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND id = ?`,
  )
    .bind(
      Number(input.card_number ?? input.cardNumber ?? current.card_number) || 0,
      clean(input.name ?? current.name, 180),
      clean(input.name_ja ?? input.nameJa ?? current.name_ja, 180),
      clean(input.image_url ?? input.imageUrl ?? current.image_url, 1000),
      clean(input.storage_provider ?? input.storageProvider ?? current.storage_provider, 80) || "url",
      clean(input.storage_key ?? input.storageKey ?? current.storage_key, 1000),
      clean(input.upright_meaning ?? input.uprightMeaning ?? current.upright_meaning, 3000),
      clean(input.reversed_meaning ?? input.reversedMeaning ?? current.reversed_meaning, 3000),
      clean(input.love_meaning ?? input.loveMeaning ?? current.love_meaning, 2000),
      clean(input.work_meaning ?? input.workMeaning ?? current.work_meaning, 2000),
      clean(input.money_meaning ?? input.moneyMeaning ?? current.money_meaning, 2000),
      input.keywords === undefined ? current.keywords_json : toJsonList(input.keywords),
      input.tags === undefined ? current.tags_json : toJsonList(input.tags),
      clean(input.sns_summary ?? input.snsSummary ?? current.sns_summary, 500),
      input.sns_use_allowed === false || input.snsUseAllowed === false ? 0 : 1,
      input.enabled === false ? 0 : 1,
      Number(input.sort_order ?? input.sortOrder ?? current.sort_order) || 0,
      tenantId,
      id,
    )
    .run();
  return getCard(db, id, tenantId);
}

export async function deleteCard(db: D1, input: Record<string, unknown>, tenantId = CARD_LIBRARY_TENANT_ID) {
  const id = clean(input.id ?? input.card_id ?? input.cardId, 120);
  if (!id) throw new Error("id is required.");
  const current = await getCard(db, id, tenantId);
  if (!current) throw new Error("Card not found.");
  await db.prepare("DELETE FROM card_library_cards WHERE tenant_id = ? AND id = ?").bind(tenantId, id).run();
  await db.prepare("UPDATE card_library_decks SET updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?").bind(tenantId, current.deck_id).run();
  await db.prepare("UPDATE card_drive_import_items SET status = 'deleted' WHERE tenant_id = ? AND card_id = ?").bind(tenantId, id).run();
  return { id, deck_id: current.deck_id, deleted: true };
}

export async function selectCards(db: D1, input: Record<string, unknown>, tenantId = CARD_LIBRARY_TENANT_ID) {
  const deckId = clean(input.deck_id ?? input.deckId, 120);
  const count = Math.min(Math.max(Number(input.count || 1), 1), 12);
  const mode = clean(input.selection_mode ?? input.selectionMode, 40) === "least_used" ? "least_used" : "random";
  const tag = clean(input.tag, 80);
  const excludeRecentDays = Math.max(Number(input.exclude_recent_days ?? input.excludeRecentDays ?? 0), 0);
  const deckFilter = deckId ? "AND c.deck_id = ?" : "";
  const params: unknown[] = [tenantId, tenantId];
  if (deckId) params.push(deckId);
  params.push(tag, `%${tag}%`);
  params.push(excludeRecentDays, tenantId, excludeRecentDays);
  const result = await db.prepare(
    `SELECT c.*, d.name AS deck_name, COALESCE(u.usage_count, 0) AS usage_count
      FROM card_library_cards c
      INNER JOIN card_library_decks d ON d.tenant_id = c.tenant_id AND d.id = c.deck_id
      LEFT JOIN (
        SELECT tenant_id, card_id, COUNT(*) AS usage_count
        FROM card_usage_history
        WHERE tenant_id = ?
        GROUP BY tenant_id, card_id
      ) u ON u.tenant_id = c.tenant_id AND u.card_id = c.id
      WHERE c.tenant_id = ?
        ${deckFilter}
        AND c.enabled = 1
        AND c.sns_use_allowed = 1
        AND d.status = 'active'
        AND d.sns_use_allowed = 1
        AND (? = '' OR c.tags_json LIKE ?)
        AND (
          ? = 0 OR NOT EXISTS (
            SELECT 1 FROM card_usage_history h
            WHERE h.tenant_id = ? AND h.card_id = c.id AND datetime(h.used_at) >= datetime('now', '-' || ? || ' days')
          )
        )
      ORDER BY c.sort_order ASC, c.card_number ASC`,
  ).bind(...params).all<CardLibraryCard & { deck_name?: string }>();
  const selected = selectCardCandidates(result.results || [], count, mode).map((card) => ({ ...decorateCard(card), deck_name: card.deck_name }));
  return { cards: selected, mode, count: selected.length };
}

export async function recordCardUsage(db: D1, input: { cards: { id: string; deck_id: string }[]; contentType?: string; snsPlatform?: string; postId?: string; contentId?: string; selectionMode?: string }, tenantId = CARD_LIBRARY_TENANT_ID) {
  for (const card of input.cards) {
    await db.prepare(
      "INSERT INTO card_usage_history (id, tenant_id, deck_id, card_id, content_type, sns_platform, post_id, content_id, selection_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), tenantId, card.deck_id, card.id, input.contentType || "sns", input.snsPlatform || "", input.postId || "", input.contentId || "", input.selectionMode || "random")
      .run();
  }
}

export async function getCardUsageHistory(db: D1, input: { deckId?: string; cardId?: string }, tenantId = CARD_LIBRARY_TENANT_ID) {
  const deckId = clean(input.deckId, 120);
  const cardId = clean(input.cardId, 120);
  const result = await db.prepare(
    `SELECT h.*, c.name, c.name_ja, d.name AS deck_name
      FROM card_usage_history h
      LEFT JOIN card_library_cards c ON c.tenant_id = h.tenant_id AND c.id = h.card_id
      LEFT JOIN card_library_decks d ON d.tenant_id = h.tenant_id AND d.id = h.deck_id
      WHERE h.tenant_id = ? AND (? = '' OR h.deck_id = ?) AND (? = '' OR h.card_id = ?)
      ORDER BY datetime(h.used_at) DESC LIMIT 100`,
  ).bind(tenantId, deckId, deckId, cardId, cardId).all();
  return result.results || [];
}
