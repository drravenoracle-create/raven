import Link from "next/link";

const lunaUrl = "https://luna.fortunestudios.jp";
const scarletUrl = "https://scarlet.fortunestudios.jp";

const members = [
  {
    id: "luna",
    name: "ルナ・スターウィンド",
    role: "月と花の相談役",
    relation: "レイヴンの弟子",
    summary: "恋愛や人間関係で揺れる気持ちを、やさしく整理するギルドメンバー。相談者が自分の本音に戻れるよう、静かな言葉で道筋を照らします。",
    tone: "やわらかく、親しみやすく、気持ちに寄り添う。",
    accent: "#4d6d77",
    href: lunaUrl,
  },
  {
    id: "scarlet",
    name: "スカーレット・ドノバン",
    role: "境界線と守りの相談役",
    relation: "レイヴンの長年の戦友",
    summary: "距離感、決断、守る力を扱うギルドメンバー。人間関係で自分をすり減らしている人に、守るべき境界線を思い出させます。",
    tone: "冷静で誠実。必要なことをはっきり伝える。",
    accent: "#9d2d3e",
    href: scarletUrl,
  },
  {
    id: "atlas",
    name: "アトラススミス",
    role: "現実整理と修理の相談役",
    relation: "レイヴンの仲間",
    summary: "仕事、生活、計画整理に強いギルドメンバー。抽象的な不安を分解し、今日できる作業と整える順番に落とし込みます。",
    tone: "実務的で、職人気質。具体的に助言する。",
    accent: "#6f5a42",
  },
  {
    id: "sol",
    name: "ソル・オーロラ",
    role: "希望と再出発の相談役",
    relation: "ギルドのムードメーカー",
    summary: "自己肯定感、新しい始まり、気持ちの切り替えを扱うギルドメンバー。不安の中でも小さな希望を見つけ、次の一歩につなげます。",
    tone: "明るく前向き。ただし痛みを軽く扱わない。",
    accent: "#d39a2e",
  },
];

export const metadata = {
  title: "レイヴン・ブラックウッドのギルド紹介",
  description: "レイヴン・ブラックウッド、ルナ・スターウィンド、スカーレット・ドノバンたちのギルドメンバー紹介ページです。",
};

export default function GuildPage() {
  return (
    <main className="raven-page min-h-screen bg-[#f6f2ea] text-[#1d2320]">
      <section className="raven-content-shell mx-auto max-w-7xl px-5 py-8">
        <header className="raven-card p-5 sm:p-6">
          <nav className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-[#596d51]">
            <Link href="/">レイヴン・ブラックウッド</Link>
            <Link href="/divination-methods/">レイヴンの占術</Link>
            <Link href="/blog/">ギルド日記</Link>
          </nav>
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Guild Profile</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">レイヴン・ブラックウッドのギルド</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#56615a]">
            ギルドは未来を断定する場所ではなく、相談者が自分の状況を整理し、次の一歩を選ぶための静かな拠点です。レイヴン・ブラックウッドを中心に、役割の違うメンバーが相談テーマごとの入口を担います。
          </p>
        </header>

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="raven-card p-5">
            <p className="text-sm font-semibold text-[#596d51]">Founder</p>
            <h2 className="mt-2 text-3xl font-semibold">レイヴン・ブラックウッド</h2>
            <p className="mt-3 leading-7 text-[#56615a]">
              元軍師。冷静で知的、神秘的でありながら現実的な相談役です。ギルド創設者として、相談者が恐れではなく判断軸から次の行動を選べるよう導きます。
            </p>
            <Link className="mt-4 inline-block text-sm font-semibold text-[#596d51] underline underline-offset-4" href="/divination-methods/">
              奇門遁甲・六壬神課・太乙神数・易経について読む
            </Link>
          </aside>
          <div className="raven-card p-5">
            <h2 className="text-2xl font-semibold">ギルドを支える仲間たち</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#4b574e] sm:grid-cols-3">
              <li className="rounded bg-white/70 p-3">ギルド創設者<br /><strong>レイヴン・ブラックウッド</strong></li>
              <li className="rounded bg-white/70 p-3">月と花の相談役<br /><a className="font-semibold text-[#315f70] underline" href={lunaUrl}>ルナ・スターウィンド</a></li>
              <li className="rounded bg-white/70 p-3">境界線と守りの相談役<br /><a className="font-semibold text-[#8c2637] underline" href={scarletUrl}>スカーレット・ドノバン</a></li>
            </ul>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {members.map((member) => (
            <article key={member.id} className="raven-card p-5" style={{ borderTop: `6px solid ${member.accent}` }}>
              <p className="text-sm font-semibold text-[#596d51]">{member.role}</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {member.href ? <a className="text-[#1d2320] underline decoration-[#4d6d77]/50 underline-offset-4" href={member.href}>{member.name}</a> : member.name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#6c5f3d]">{member.relation}</p>
              <p className="mt-3 leading-7 text-[#56615a]">{member.summary}</p>
              <p className="mt-4 rounded bg-white/70 p-3 text-sm leading-6 text-[#303a33]">{member.tone}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}


