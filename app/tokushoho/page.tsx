import Link from "next/link";

const rows = [
  ["販売事業者", "レイヴン・ブラックウッド運営事務局"],
  ["運営責任者", "請求があった場合、遅滞なく開示します。"],
  ["所在地", "請求があった場合、遅滞なく開示します。"],
  ["連絡先", "サイト内または予約・決済画面に記載の連絡手段をご利用ください。"],
  ["販売価格", "各サービスページ、予約画面、決済画面に表示します。"],
  ["商品代金以外の必要料金", "通信料、振込手数料その他利用環境に応じた費用は利用者負担です。"],
  ["支払方法", "各決済画面に表示される方法によります。"],
  ["提供時期", "予約または申込時に表示される日時、または個別に合意した時期に提供します。"],
  ["キャンセル・返金", "サービスの性質上、提供開始後の返金は原則として受け付けません。個別条件がある場合は各申込画面を優先します。"],
];

export const metadata = {
  title: "特定商取引法に基づく表記 | レイヴン・ブラックウッド",
  description: "レイヴン・ブラックウッドの特定商取引法に基づく表記。",
};

export default function TokushohoPage() {
  return (
    <main className="raven-page min-h-screen">
      <section className="raven-content-shell mx-auto max-w-4xl px-5 py-8">
        <header className="raven-card p-5 sm:p-6">
          <nav className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <Link href="/">トップ</Link>
            <Link href="/faq/">FAQ</Link>
            <Link href="/privacy/">個人情報保護方針</Link>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6d6945]">Legal</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">特定商取引法に基づく表記</h1>
          <p className="mt-4 leading-8 text-[#56615a]">
            サービス提供に関する表示事項です。個別の申込画面に条件が記載されている場合は、その表示を優先します。
          </p>
        </header>
        <div className="raven-card mt-8 divide-y divide-[#d5c9b8]">
          {rows.map(([label, value]) => (
            <div className="grid md:grid-cols-[220px_1fr]" key={label}>
              <div className="bg-[#eee4d5] p-4 font-semibold">{label}</div>
              <div className="p-4 leading-8 text-[#56615a]">{value}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
