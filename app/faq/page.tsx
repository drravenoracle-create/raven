import Link from "next/link";

const items = [
  ["何を鑑定できますか", "送信前の文章、相談文、日記、メモをもとに、感情の温度、意図、伝わり方、次に取る行動を整理します。"],
  ["未来を断定しますか", "断定はしません。占いと対話を、状況を見直すための補助として扱います。"],
  ["無料占いはトップの主機能ですか", "いいえ。レイヴン・ブラックウッドの中心はテキスト鑑定と相談整理です。無料占いは入口のひとつとして配置しています。"],
  ["個人情報を入力してもよいですか", "本名、住所、電話番号、口座情報、医療情報などは入力しないでください。必要な範囲で匿名化してください。"],
  ["医療・法律・投資の判断に使えますか", "使えません。専門家の判断が必要な内容は、必ず該当する専門機関へ相談してください。"],
];

export const metadata = {
  title: "FAQ | レイヴン・ブラックウッド",
  description: "レイヴン・ブラックウッドのテキスト鑑定に関するよくある質問。",
};

export default function FAQPage() {
  return (
    <main className="raven-page min-h-screen">
      <section className="raven-content-shell mx-auto max-w-4xl px-5 py-8">
        <header className="raven-card p-5 sm:p-6">
          <nav className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <Link href="/">トップ</Link>
            <Link href="/guild/">ギルド</Link>
            <Link href="/text-reading/">AIテキスト鑑定</Link>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6d6945]">FAQ</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">よくある質問</h1>
          <p className="mt-4 leading-8 text-[#56615a]">
            鑑定前に確認しておきたいことをまとめています。判断を急がせず、安心して相談内容を整理するための案内です。
          </p>
        </header>
        <div className="mt-8 grid gap-4">
          {items.map(([question, answer]) => (
            <article key={question} className="raven-card p-5">
              <h2 className="text-xl font-semibold">{question}</h2>
              <p className="mt-3 leading-8 text-[#56615a]">{answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
