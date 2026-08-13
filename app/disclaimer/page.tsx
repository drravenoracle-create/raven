import Link from "next/link";

const sections = [
  ["鑑定結果について", "本サイトの鑑定、文章整理、助言は、利用者が状況を見直すための参考情報です。未来、相手の気持ち、結果を保証するものではありません。"],
  ["専門判断について", "医療、法律、税務、投資、生命・身体の安全に関わる判断は、必ず専門家または公的機関へ相談してください。"],
  ["利用者の判断", "本サイトの内容を利用した結果生じた損害について、運営者は法令上認められる範囲で責任を負いません。"],
  ["AI機能について", "AIによる出力には誤り、不完全な表現、文脈の取り違えが含まれる場合があります。重要な判断には使用しないでください。"],
];

export const metadata = {
  title: "免責事項 | レイヴン・ブラックウッド",
  description: "レイヴン・ブラックウッドの免責事項。",
};

export default function DisclaimerPage() {
  return (
    <main className="raven-page min-h-screen">
      <section className="raven-content-shell mx-auto max-w-4xl px-5 py-8">
        <header className="raven-card p-5 sm:p-6">
          <nav className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <Link href="/">トップ</Link>
            <Link href="/faq/">FAQ</Link>
            <Link href="/privacy/">個人情報保護方針</Link>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6d6945]">Disclaimer</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">免責事項</h1>
          <p className="mt-4 leading-8 text-[#56615a]">
            鑑定とAI出力は、判断材料を整理するための補助です。重要な判断は、必ず専門家や公的機関の情報と照らし合わせてください。
          </p>
        </header>
        <div className="mt-8 grid gap-4">
          {sections.map(([title, body]) => (
            <article className="raven-card p-5" key={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-8 text-[#56615a]">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
