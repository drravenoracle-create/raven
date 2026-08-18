"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Deck = {
  id: string;
  name: string;
  slug: string;
  deck_type: string;
  description: string;
  card_count: number;
  back_image_url: string;
  copyright_status: string;
  commercial_use_allowed: number;
  sns_use_allowed: number;
  status: string;
  registered_cards?: number;
};

type Card = {
  id: string;
  deck_id: string;
  card_number: number;
  name: string;
  name_ja: string;
  image_url: string;
  storage_key?: string;
  upright_meaning: string;
  reversed_meaning: string;
  love_meaning: string;
  work_meaning: string;
  money_meaning: string;
  keywords: string[];
  tags: string[];
  sns_summary: string;
  sns_use_allowed: number;
  enabled: number;
  usage_count?: number;
};

type Usage = {
  id: string;
  deck_name?: string;
  name?: string;
  name_ja?: string;
  content_type?: string;
  sns_platform?: string;
  selection_mode?: string;
  used_at?: string;
};

type DriveFolder = { id: string; name: string; webViewLink?: string; modifiedTime?: string };
type DriveImageCandidate = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailUrl: string;
  webViewLink: string;
  card_number: number;
  card_name: string;
  selected?: boolean;
  importName?: string;
  importNameJa?: string;
};
type DriveImportJob = {
  id: string;
  status: string;
  source_folder_name?: string;
  total_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  created_at?: string;
};

const tenantId = "raven-oracle";

function isSelectableDeck(deck: Deck) {
  return deck.status === "active" && Boolean(deck.sns_use_allowed);
}

const emptyCard = {
  card_number: "1",
  name: "",
  name_ja: "",
  image_url: "",
  upright_meaning: "",
  reversed_meaning: "",
  love_meaning: "",
  work_meaning: "",
  money_meaning: "",
  keywords: "",
  tags: "",
  sns_summary: "",
  sns_use_allowed: true,
  enabled: true,
};

export default function DeckManagerPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [status, setStatus] = useState("読み込み中...");
  const [busy, setBusy] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState("");
  const [cardForm, setCardForm] = useState(emptyCard);
  const [cardFilter, setCardFilter] = useState({ q: "", enabled: "all", tag: "" });
  const [selection, setSelection] = useState<Card[]>([]);
  const [selectCount, setSelectCount] = useState(1);
  const [selectionMode, setSelectionMode] = useState("random");
  const [excludeRecentDays, setExcludeRecentDays] = useState(0);
  const [driveFolderQuery, setDriveFolderQuery] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [driveFolderName, setDriveFolderName] = useState("");
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [driveImages, setDriveImages] = useState<DriveImageCandidate[]>([]);
  const [driveDuplicatePolicy, setDriveDuplicatePolicy] = useState("skip");
  const [driveJobs, setDriveJobs] = useState<DriveImportJob[]>([]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.id === selectedDeckId) || decks.find(isSelectableDeck) || decks[0],
    [decks, selectedDeckId],
  );

  const selectedCards = useMemo(
    () => cards.filter((card) => !selectedDeckId || !selectedDeck?.id || card.deck_id === selectedDeck.id),
    [cards, selectedDeck, selectedDeckId],
  );

  async function readJson(response: Response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`APIレスポンスを読めませんでした: ${response.status}`);
    }
  }

  async function loadAll(deckId = selectedDeckId) {
    setStatus("Card Libraryを読み込んでいます...");
    try {
      const [deckResponse, cardResponse, usageResponse] = await Promise.all([
        fetch("/api/card-library?resource=decks&tenantId=raven-oracle", { cache: "no-store" }),
        fetch(
          `/api/card-library?resource=cards&tenantId=raven-oracle&deckId=${encodeURIComponent(deckId)}&q=${encodeURIComponent(cardFilter.q)}&enabled=${encodeURIComponent(cardFilter.enabled)}&tag=${encodeURIComponent(cardFilter.tag)}`,
          { cache: "no-store" },
        ),
        fetch("/api/card-library?resource=usage&tenantId=raven-oracle", { cache: "no-store" }),
      ]);
      const deckPayload = await readJson(deckResponse);
      const cardPayload = await readJson(cardResponse);
      const usagePayload = await readJson(usageResponse);
      if (!deckResponse.ok || !cardResponse.ok || !usageResponse.ok) {
        throw new Error(deckPayload.error || cardPayload.error || usagePayload.error || "読み込みに失敗しました。");
      }
      const nextDecks = deckPayload.decks || [];
      setDecks(nextDecks);
      setCards(cardPayload.cards || []);
      setUsage(usagePayload.usage || []);
      const currentDeck = nextDecks.find((deck: Deck) => deck.id === selectedDeckId);
      const activeDeck = nextDecks.find(isSelectableDeck);
      if ((!selectedDeckId || !currentDeck || !isSelectableDeck(currentDeck)) && activeDeck) {
        setSelectedDeckId(activeDeck.id);
      } else if (!selectedDeckId && nextDecks[0]) {
        setSelectedDeckId(nextDecks[0].id);
      }
      setStatus("Card Libraryを読み込みました。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "読み込みに失敗しました。");
    }
  }

  useEffect(() => {
    loadAll("");
    loadDriveJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setStatus("保存しています...");
    try {
      const response = await fetch("/api/card-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, action, ...body }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "操作に失敗しました。");
      setStatus("保存しました。");
      await loadAll(selectedDeckId);
      return payload;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "操作に失敗しました。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createDeck(formData: FormData) {
    const payload = await post("createDeck", {
      name: formData.get("name"),
      slug: formData.get("slug"),
      deck_type: formData.get("deck_type"),
      description: formData.get("description"),
      card_count: Number(formData.get("card_count") || 0),
      back_image_url: formData.get("back_image_url"),
      copyright_status: formData.get("copyright_status"),
      commercial_use_allowed: formData.get("commercial_use_allowed") === "on",
      sns_use_allowed: formData.get("sns_use_allowed") === "on",
      status: formData.get("status"),
    });
    if (payload?.deck?.id) setSelectedDeckId(payload.deck.id);
  }

  async function saveDeck(nextStatus?: string) {
    if (!selectedDeck) return;
    await post("updateDeck", {
      id: selectedDeck.id,
      name: selectedDeck.name,
      slug: selectedDeck.slug,
      deck_type: selectedDeck.deck_type,
      description: selectedDeck.description,
      card_count: selectedDeck.card_count,
      back_image_url: selectedDeck.back_image_url,
      copyright_status: selectedDeck.copyright_status,
      commercial_use_allowed: Boolean(selectedDeck.commercial_use_allowed),
      sns_use_allowed: Boolean(selectedDeck.sns_use_allowed),
      status: nextStatus || selectedDeck.status,
    });
  }

  async function createCard() {
    if (!selectedDeck?.id) {
      setStatus("先にデッキを選択してください。");
      return;
    }
    const payload = await post("createCard", { deck_id: selectedDeck.id, ...cardForm });
    if (payload?.card) setCardForm(emptyCard);
  }

  async function deleteRegisteredCard(card: Card) {
    const cardName = card.name_ja || card.name || card.id;
    if (!window.confirm(`${cardName} を削除します。よろしいですか？`)) return;
    setBusy(true);
    setDeletingCardId(card.id);
    setStatus("カードを削除しています...");
    try {
      const response = await fetch("/api/card-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, action: "deleteCard", id: card.id }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "カード削除に失敗しました。");
      setSelection((current) => current.filter((item) => item.id !== card.id));
      setStatus(`${cardName} を削除しました。`);
      await loadAll(selectedDeck?.id || selectedDeckId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "カード削除に失敗しました。");
    } finally {
      setDeletingCardId("");
      setBusy(false);
    }
  }

  async function drawCards() {
    if (!selectedDeck?.id) {
      setStatus("先にデッキを選択してください。");
      return;
    }
    if (!isSelectableDeck(selectedDeck)) {
      setStatus("選出テストは active / SNS利用可 のデッキだけが対象です。デッキ一覧から active のデッキを選ぶか、このデッキを active / SNS利用可にしてください。");
      return;
    }
    setBusy(true);
    setSelection([]);
    setStatus("選出テストを実行しています...");
    try {
      const response = await fetch("/api/card-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          action: "selectCards",
          deck_id: selectedDeck.id,
          count: selectCount,
          selection_mode: selectionMode,
          exclude_recent_days: excludeRecentDays,
        }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "カード選出に失敗しました。");
      const selected = payload.selection?.cards || [];
      setSelection(selected);
      setStatus(
        selected.length
          ? `${selected.length}枚を選出しました。`
          : "選出対象がありません。カードが有効/SNS利用可か確認してください。直近除外日数を入れている場合は0日に戻して試してください。",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "カード選出に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function loadDriveJobs() {
    try {
      const response = await fetch("/api/card-library/drive-import?resource=jobs&tenantId=raven-oracle", { cache: "no-store" });
      const payload = await readJson(response);
      if (response.ok && payload.ok) setDriveJobs(payload.jobs || []);
    } catch {}
  }

  async function searchDriveFolders() {
    setBusy(true);
    setStatus("Google Driveフォルダを検索しています...");
    try {
      const response = await fetch(`/api/card-library/drive-import?resource=folders&tenantId=raven-oracle&q=${encodeURIComponent(driveFolderQuery)}`, { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Driveフォルダ検索に失敗しました。");
      setDriveFolders(payload.folders || []);
      setStatus((payload.folders || []).length ? "Driveフォルダを取得しました。" : "Driveフォルダが見つかりません。サービスアカウントへフォルダ共有されているか確認してください。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Driveフォルダ検索に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function loadDriveImages(folderId = driveFolderId, folderName = driveFolderName) {
    if (!folderId) {
      setStatus("Driveフォルダを選択またはフォルダIDを入力してください。");
      return;
    }
    setBusy(true);
    setStatus("Drive画像を読み込んでいます...");
    try {
      const response = await fetch(`/api/card-library/drive-import?resource=images&tenantId=raven-oracle&folderId=${encodeURIComponent(folderId)}`, { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Drive画像の取得に失敗しました。");
      const images = (payload.images || []).map((image: DriveImageCandidate) => ({
        ...image,
        selected: Boolean(image.card_number && image.card_name),
        importName: image.card_name || "",
        importNameJa: image.card_name || "",
      }));
      setDriveFolderId(folderId);
      setDriveFolderName(folderName);
      setDriveImages(images);
      setStatus(`${images.length}件のDrive画像を取得しました。番号とカード名を確認してください。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Drive画像の取得に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  function updateDriveImage(id: string, patch: Partial<DriveImageCandidate>) {
    setDriveImages((current) => current.map((image) => (image.id === id ? { ...image, ...patch } : image)));
  }

  function setAllDriveImages(selected: boolean) {
    setDriveImages((current) => current.map((image) => ({ ...image, selected })));
  }

  async function importDriveImages() {
    if (!selectedDeck?.id) {
      setStatus("先に対象デッキを選択してください。");
      return;
    }
    const files = driveImages
      .filter((image) => image.selected)
      .map((image) => ({
        fileId: image.id,
        fileName: image.name,
        mimeType: image.mimeType,
        sizeBytes: image.size,
        card_number: Number(image.card_number || 0),
        name: image.importName || image.card_name,
        name_ja: image.importNameJa || image.importName || image.card_name,
      }));
    if (!files.length) {
      setStatus("取り込む画像を選択してください。");
      return;
    }
    setBusy(true);
    setStatus("Drive画像を運用Storageへコピーし、カード登録しています...");
    try {
      const response = await fetch("/api/card-library/drive-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          action: "importBulk",
          deck_id: selectedDeck.id,
          folder_id: driveFolderId,
          folder_name: driveFolderName,
          duplicate_policy: driveDuplicatePolicy,
          files,
        }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Drive画像の一括登録に失敗しました。");
      setStatus(`Drive import完了: 成功 ${payload.success} / skip ${payload.skipped} / 失敗 ${payload.failed}`);
      await Promise.all([loadAll(selectedDeck.id), loadDriveJobs()]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Drive画像の一括登録に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  function updateSelectedDeck(patch: Partial<Deck>) {
    if (!selectedDeck) return;
    setDecks((current) => current.map((deck) => (deck.id === selectedDeck.id ? { ...deck, ...patch } : deck)));
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap justify-between gap-3">
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/sns/">SNS Engine</Link>
        </nav>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Deck Manager / Card Library V1</p>
          <h1 className="mt-2 text-4xl font-semibold">Deck Manager</h1>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">
            カードデッキ、登録済みカード、SNS投稿用の選出テストを管理します。画像はURLまたはStorage参照として扱い、D1にはカード情報だけを保存します。
          </p>
        </header>

        <section className="sticky top-0 z-10 -mx-5 mt-5 border-y border-[#d7cabc] bg-[#f5f0e8]/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <Metric label="デッキ" value={decks.length} />
              <Metric label="カード" value={cards.length} />
              <Metric label="履歴" value={usage.length} />
            </div>
            <p className="text-sm font-semibold text-[#596d51]">{status}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="grid gap-5">
            <Panel title="デッキ作成" eyebrow="Create Deck">
              <form action={createDeck}>
                <label className="grid gap-2 text-sm font-semibold">デッキ名<input className="admin-field" name="name" required /></label>
                <label className="mt-3 grid gap-2 text-sm font-semibold">スラッグ<input className="admin-field" name="slug" placeholder="raven-oracle-deck" /></label>
                <label className="mt-3 grid gap-2 text-sm font-semibold">種類<select className="admin-field" name="deck_type" defaultValue="oracle"><option value="tarot">tarot</option><option value="lenormand">lenormand</option><option value="oracle">oracle</option><option value="other">other</option></select></label>
                <label className="mt-3 grid gap-2 text-sm font-semibold">説明<textarea className="admin-field min-h-24" name="description" /></label>
                <label className="mt-3 grid gap-2 text-sm font-semibold">想定カード枚数<input className="admin-field" name="card_count" type="number" min="0" defaultValue="0" /></label>
                <label className="mt-3 grid gap-2 text-sm font-semibold">裏面画像URL / 参照<input className="admin-field" name="back_image_url" /></label>
                <label className="mt-3 grid gap-2 text-sm font-semibold">権利区分<input className="admin-field" name="copyright_status" defaultValue="owned" /></label>
                <label className="mt-3 grid gap-2 text-sm font-semibold">ステータス<select className="admin-field" name="status" defaultValue="draft"><option value="draft">draft</option><option value="active">active</option><option value="archived">archived</option></select></label>
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input name="commercial_use_allowed" type="checkbox" /> 商用利用可</label>
                <label className="mt-2 flex items-center gap-2 text-sm font-semibold"><input name="sns_use_allowed" type="checkbox" /> SNS利用可</label>
                <button className="mt-4 w-full rounded bg-[#222820] px-4 py-3 font-semibold text-[#fff8ed] disabled:opacity-60" disabled={busy}>デッキ作成</button>
              </form>
            </Panel>

            <Panel title="デッキ一覧" eyebrow="Decks">
              <div className="grid gap-2">
                {decks.map((deck) => (
                  <button key={deck.id} className={`rounded border p-3 text-left ${selectedDeck?.id === deck.id ? "border-[#596d51] bg-white ring-2 ring-[#596d51]/20" : "border-[#d7cabc] bg-white"}`} type="button" onClick={() => { setSelectedDeckId(deck.id); loadAll(deck.id); }}>
                    <span className="block text-xs font-semibold text-[#6c5f3d]">{deck.deck_type} / {deck.status} / SNS {deck.sns_use_allowed ? "可" : "不可"}</span>
                    <span className="mt-1 block font-semibold">{deck.name}</span>
                    <span className="mt-1 block text-xs text-[#5e625c]">{deck.registered_cards || 0} / {deck.card_count || "-"} 枚</span>
                  </button>
                ))}
                {!decks.length ? <p className="text-sm text-[#5e625c]">デッキはまだありません。</p> : null}
              </div>
            </Panel>
          </aside>

          <section className="grid gap-5">
            <Panel title="デッキ編集" eyebrow="Edit Deck">
              {selectedDeck ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold">デッキ名<input className="admin-field" value={selectedDeck.name} onChange={(event) => updateSelectedDeck({ name: event.target.value })} /></label>
                  <label className="grid gap-2 text-sm font-semibold">ステータス<select className="admin-field" value={selectedDeck.status} onChange={(event) => updateSelectedDeck({ status: event.target.value })}><option value="draft">draft</option><option value="active">active</option><option value="archived">archived</option></select></label>
                  <label className="grid gap-2 text-sm font-semibold md:col-span-2">説明<textarea className="admin-field min-h-24" value={selectedDeck.description} onChange={(event) => updateSelectedDeck({ description: event.target.value })} /></label>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(selectedDeck.commercial_use_allowed)} onChange={(event) => updateSelectedDeck({ commercial_use_allowed: event.target.checked ? 1 : 0 })} /> 商用利用可</label>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(selectedDeck.sns_use_allowed)} onChange={(event) => updateSelectedDeck({ sns_use_allowed: event.target.checked ? 1 : 0 })} /> SNS利用可</label>
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <button className="rounded bg-[#222820] px-4 py-3 text-sm font-semibold text-[#fff8ed]" type="button" onClick={() => saveDeck()}>保存</button>
                    <button className="rounded border border-[#d7cabc] px-4 py-3 text-sm font-semibold" type="button" onClick={() => saveDeck("active")}>activeにする</button>
                    <button className="rounded border border-[#d7cabc] px-4 py-3 text-sm font-semibold" type="button" onClick={() => saveDeck("archived")}>アーカイブ</button>
                  </div>
                </div>
              ) : <p className="text-sm text-[#5e625c]">デッキを作成または選択してください。</p>}
            </Panel>

            <Panel title="カード登録" eyebrow="Create Card">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold">番号<input className="admin-field" type="number" value={cardForm.card_number} onChange={(event) => setCardForm({ ...cardForm, card_number: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">カード名<input className="admin-field" value={cardForm.name} onChange={(event) => setCardForm({ ...cardForm, name: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">日本語名<input className="admin-field" value={cardForm.name_ja} onChange={(event) => setCardForm({ ...cardForm, name_ja: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold md:col-span-3">画像URL / Storage Key<input className="admin-field" value={cardForm.image_url} onChange={(event) => setCardForm({ ...cardForm, image_url: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">正位置<textarea className="admin-field min-h-28" value={cardForm.upright_meaning} onChange={(event) => setCardForm({ ...cardForm, upright_meaning: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">逆位置<textarea className="admin-field min-h-28" value={cardForm.reversed_meaning} onChange={(event) => setCardForm({ ...cardForm, reversed_meaning: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">SNS短文<textarea className="admin-field min-h-28" value={cardForm.sns_summary} onChange={(event) => setCardForm({ ...cardForm, sns_summary: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">恋愛<textarea className="admin-field min-h-24" value={cardForm.love_meaning} onChange={(event) => setCardForm({ ...cardForm, love_meaning: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">仕事<textarea className="admin-field min-h-24" value={cardForm.work_meaning} onChange={(event) => setCardForm({ ...cardForm, work_meaning: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">金運<textarea className="admin-field min-h-24" value={cardForm.money_meaning} onChange={(event) => setCardForm({ ...cardForm, money_meaning: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">キーワード<input className="admin-field" value={cardForm.keywords} onChange={(event) => setCardForm({ ...cardForm, keywords: event.target.value })} placeholder="カンマ区切り" /></label>
                <label className="grid gap-2 text-sm font-semibold">タグ<input className="admin-field" value={cardForm.tags} onChange={(event) => setCardForm({ ...cardForm, tags: event.target.value })} placeholder="daily, love" /></label>
                <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cardForm.enabled} onChange={(event) => setCardForm({ ...cardForm, enabled: event.target.checked })} /> 有効</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cardForm.sns_use_allowed} onChange={(event) => setCardForm({ ...cardForm, sns_use_allowed: event.target.checked })} /> SNS利用可</label>
                </div>
              </div>
              <button className="mt-4 rounded bg-[#222820] px-4 py-3 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={createCard} disabled={busy}>カード登録</button>
            </Panel>

            <Panel title="Google Driveから追加" eyebrow="Drive Import">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input className="admin-field" value={driveFolderQuery} onChange={(event) => setDriveFolderQuery(event.target.value)} placeholder="Driveフォルダ名で検索" />
                <button className="rounded border border-[#d7cabc] px-4 py-2 text-sm font-semibold disabled:opacity-60" type="button" onClick={searchDriveFolders} disabled={busy}>フォルダ検索</button>
              </div>
              {driveFolders.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">
                {driveFolders.map((folder) => (
                  <button key={folder.id} className="rounded border border-[#d7cabc] bg-white p-3 text-left text-sm" type="button" onClick={() => loadDriveImages(folder.id, folder.name)}>
                    <span className="block font-semibold">{folder.name}</span>
                    <span className="mt-1 block break-all text-xs text-[#5e625c]">{folder.id}</span>
                  </button>
                ))}
              </div> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <input className="admin-field" value={driveFolderId} onChange={(event) => setDriveFolderId(event.target.value)} placeholder="DriveフォルダIDを直接入力" />
                <button className="rounded border border-[#d7cabc] px-4 py-2 text-sm font-semibold disabled:opacity-60" type="button" onClick={() => loadDriveImages()} disabled={busy}>画像取得</button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" onClick={() => setAllDriveImages(true)}>全選択</button>
                <button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold" type="button" onClick={() => setAllDriveImages(false)}>選択解除</button>
                <label className="flex items-center gap-2 text-sm font-semibold">重複時<select className="admin-field max-w-40" value={driveDuplicatePolicy} onChange={(event) => setDriveDuplicatePolicy(event.target.value)}><option value="skip">skip</option><option value="replace">replace</option><option value="create_new">create new</option></select></label>
                <button className="rounded bg-[#222820] px-4 py-2 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={importDriveImages} disabled={busy || !driveImages.some((image) => image.selected)}>一括登録実行</button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#5e625c]">Drive原本は削除・移動・変更しません。R2が有効な環境では運用Storageへコピーし、R2未接続時はDrive画像をWorker経由で配信するフォールバックURLを登録します。1回の取り込みは最大20件です。</p>
              {driveImages.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {driveImages.map((image) => (
                  <article key={image.id} className={`rounded border bg-white p-3 ${image.selected ? "border-[#596d51]" : "border-[#d7cabc]"}`}>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(image.selected)} onChange={(event) => updateDriveImage(image.id, { selected: event.target.checked })} /> 取り込む</label>
                    {image.thumbnailUrl ? <img className="mt-3 aspect-[2/3] w-full rounded border border-[#d7cabc] object-cover" src={image.thumbnailUrl} alt={image.name} /> : null}
                    <p className="mt-2 break-all text-xs text-[#5e625c]">{image.name}</p>
                    <div className="mt-3 grid grid-cols-[88px_1fr] gap-2">
                      <label className="grid gap-1 text-xs font-semibold">番号<input className="admin-field" type="number" value={image.card_number || ""} onChange={(event) => updateDriveImage(image.id, { card_number: Number(event.target.value) })} /></label>
                      <label className="grid gap-1 text-xs font-semibold">カード名<input className="admin-field" value={image.importName || ""} onChange={(event) => updateDriveImage(image.id, { importName: event.target.value })} /></label>
                    </div>
                    <label className="mt-2 grid gap-1 text-xs font-semibold">日本語名<input className="admin-field" value={image.importNameJa || ""} onChange={(event) => updateDriveImage(image.id, { importNameJa: event.target.value })} /></label>
                    <p className="mt-2 text-xs text-[#5e625c]">{image.mimeType} / {formatBytes(image.size)}</p>
                  </article>
                ))}
              </div> : null}
              {driveJobs.length ? <div className="mt-5 rounded border border-[#d7cabc] bg-white p-3">
                <p className="text-sm font-semibold text-[#6c5f3d]">最近の取り込み</p>
                <div className="mt-2 grid gap-2">
                  {driveJobs.slice(0, 5).map((job) => <p key={job.id} className="text-xs leading-5 text-[#5e625c]">{job.status} / {job.source_folder_name || "-"} / 成功 {job.success_count} / skip {job.skipped_count} / 失敗 {job.failed_count} / {job.created_at || "-"}</p>)}
                </div>
              </div> : null}
            </Panel>

            <Panel title="カード一覧・選出" eyebrow="Cards">
              <div className="grid gap-3 md:grid-cols-4">
                <input className="admin-field" value={cardFilter.q} onChange={(event) => setCardFilter({ ...cardFilter, q: event.target.value })} placeholder="検索" />
                <input className="admin-field" value={cardFilter.tag} onChange={(event) => setCardFilter({ ...cardFilter, tag: event.target.value })} placeholder="タグ" />
                <select className="admin-field" value={cardFilter.enabled} onChange={(event) => setCardFilter({ ...cardFilter, enabled: event.target.value })}><option value="all">全件</option><option value="1">有効</option><option value="0">無効</option></select>
                <button className="rounded border border-[#d7cabc] px-4 py-2 text-sm font-semibold" type="button" onClick={() => loadAll(selectedDeckId)}>絞り込み</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <select className="admin-field max-w-44" value={selectCount} onChange={(event) => setSelectCount(Number(event.target.value))}><option value={1}>1枚引き</option><option value={3}>3枚引き</option><option value={5}>5枚引き</option></select>
                <select className="admin-field max-w-44" value={selectionMode} onChange={(event) => setSelectionMode(event.target.value)}><option value="random">ランダム</option><option value="least_used">未使用優先</option></select>
                <label className="flex items-center gap-2 text-sm font-semibold">直近除外日数<input className="admin-field w-24" type="number" value={excludeRecentDays} onChange={(event) => setExcludeRecentDays(Number(event.target.value))} /></label>
                <button className="rounded bg-[#596d51] px-4 py-2 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={drawCards} disabled={busy}>選出テスト</button>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#5e625c]">
                選出対象は、デッキが active / SNS利用可、カードが有効 / SNS利用可のものだけです。
              </p>
              {selection.length ? <div className="mt-4 rounded border border-[#d7cabc] bg-white p-4"><p className="text-sm font-semibold text-[#6c5f3d]">選出結果</p><div className="mt-3 grid gap-3 md:grid-cols-3">{selection.map((card) => <CardBox key={card.id} card={card} />)}</div></div> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {selectedCards.map((card) => <CardBox key={card.id} card={card} onDelete={deleteRegisteredCard} deleting={deletingCardId === card.id} />)}
              </div>
              {!selectedCards.length ? <p className="mt-4 rounded border border-dashed border-[#d7cabc] bg-white/70 p-4 text-sm text-[#5e625c]">このデッキには表示できるカードがありません。カードを登録するか、絞り込み条件を外してください。</p> : null}
            </Panel>

            <Panel title="利用履歴" eyebrow="Usage">
              <div className="grid gap-2">
                {usage.slice(0, 20).map((item) => <article key={item.id} className="rounded border border-[#d7cabc] bg-white p-3"><p className="text-xs font-semibold text-[#6c5f3d]">{item.content_type || "sns"} / {item.sns_platform || "-"} / {item.selection_mode || "-"}</p><h3 className="mt-1 font-semibold">{item.name_ja || item.name || item.id}</h3><p className="mt-1 text-xs text-[#5e625c]">{item.deck_name || "-"} / {item.used_at || "-"}</p></article>)}
                {!usage.length ? <p className="text-sm text-[#5e625c]">利用履歴はまだありません。</p> : null}
              </div>
            </Panel>
          </section>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5 shadow-sm"><p className="text-sm font-semibold uppercase text-[#6c5f3d]">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <span className="rounded border border-[#d7cabc] bg-white px-3 py-2">{label}: {value}</span>;
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function CardBox({ card, onDelete, deleting = false }: { card: Card; onDelete?: (card: Card) => void; deleting?: boolean }) {
  const imageRef = card.image_url || "";
  const detail = card.sns_summary || card.upright_meaning || card.love_meaning || card.work_meaning || card.money_meaning || "説明文は未登録です。";
  return (
    <article className={`rounded border bg-white p-3 ${card.enabled && card.sns_use_allowed ? "border-[#d7cabc]" : "border-[#c99b83]"}`}>
      {imageRef ? <img className="mb-3 aspect-[2/3] w-full rounded border border-[#d7cabc] object-cover" src={imageRef} alt={card.name_ja || card.name} /> : <div className="mb-3 grid aspect-[2/3] place-items-center rounded border border-dashed border-[#d7cabc] bg-[#f8f3ea] p-3 text-center text-xs leading-5 text-[#5e625c]">画像URL未登録<br />テキストプレビューを表示</div>}
      <p className="text-xs font-semibold text-[#6c5f3d]">No.{card.card_number} / 使用 {card.usage_count || 0}</p>
      <h3 className="mt-1 text-lg font-semibold">{card.name_ja || card.name || "名称未登録"}</h3>
      {card.name_ja && card.name ? <p className="mt-1 text-sm text-[#5e625c]">{card.name}</p> : null}
      <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#5e625c]">{detail}</p>
      {card.tags?.length ? <p className="mt-2 text-xs text-[#6c5f3d]">{card.tags.join(", ")}</p> : null}
      <p className="mt-1 text-xs text-[#5e625c]">{card.enabled ? "有効" : "無効"} / SNS {card.sns_use_allowed ? "可" : "不可"}</p>
      {onDelete ? (
        <button
          className="mt-3 w-full rounded border border-[#b96f5c] px-3 py-2 text-sm font-semibold text-[#8f3f31] disabled:opacity-60"
          type="button"
          onClick={() => onDelete(card)}
          disabled={deleting}
        >
          {deleting ? "削除中..." : "削除"}
        </button>
      ) : null}
    </article>
  );
}
