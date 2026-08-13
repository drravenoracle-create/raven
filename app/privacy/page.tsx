import Link from "next/link";

const sections = [
  ["取得する情報", "問い合わせ、予約、鑑定、分析のために必要な範囲で、入力内容、連絡先、利用日時、アクセス情報を取得する場合があります。"],
  ["利用目的", "鑑定サービスの提供、本人確認、問い合わせ対応、品質改善、不正利用防止、法令対応のために利用します。"],
  ["第三者提供", "法令に基づく場合を除き、本人の同意なく第三者へ提供しません。"],
  ["安全管理", "取得した情報は必要な範囲で管理し、不要になった情報は適切に削除します。"],
  ["入力時の注意", "相談文には、本名、住所、電話番号、口座情報、医療情報などの機微情報を含めないでください。"],
];

export const metadata = {
  title: "個人情報保護方針 | レイヴン・ブラックウッド",
  description: "レイヴン・ブラックウッドの個人情報保護方針。",
};

export default function PrivacyPage() {
  return (
    <main className="raven-page min-h-screen">
      <section className="raven-content-shell mx-auto max-w-4xl px-5 py-8">
        <header className="raven-card p-5 sm:p-6">
          <nav className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <Link href="/">トップ</Link>
            <Link href="/faq/">FAQ</Link>
            <Link href="/disclaimer/">免責事項</Link>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6d6945]">Privacy</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">個人情報保護方針</h1>
          <p className="mt-4 leading-8 text-[#56615a]">
            相談者の情報は、鑑定と運営に必要な範囲で扱います。相談文には、不要な個人情報を含めないでください。
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
