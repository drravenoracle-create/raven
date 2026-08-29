import Link from "next/link";

const memberSites = [
  { name: "レイヴン・ブラックウッド", role: "Guild Core", url: "https://raven.fortunestudios.jp/", note: "公式サイト・ギルド中核" },
  { name: "Luna Starwind", role: "Luna", url: "https://luna.fortunestudios.jp/", note: "恋愛・人間関係" },
  { name: "Scarlet Donovan", role: "Scarlet", url: "https://scarlet.fortunestudios.jp/", note: "マヤ暦・インド占星術" },
  { name: "Atlas Smith", role: "Atlas", url: "https://atlas-oracle.fortune-kanri.workers.dev/", note: "現実整理・工房" },
  { name: "Sol Aurora", role: "Sol", url: "https://sol-oracle.fortune-kanri.workers.dev/", note: "希望・カード解説" },
  { name: "ルビー瞳", role: "Ruby", url: "https://ruby-hitomi.fortunestudios.jp/", note: "恋愛・復縁" },
];

const adminLinks = [
  ["管理ダッシュボード", "/admin/", "全体サマリー・今日の確認"],
  ["ブログ運用", "/admin/blog/", "記事・公開状態・カレンダー"],
  ["アクセス分析", "/admin/analytics/", "流入・KPI・イベント"],
  ["会員管理", "/admin/members/", "会員・鑑定履歴の確認"],
  ["カード管理", "/admin/decks/", "デッキ・カード情報・選出"],
  ["SNS運用", "/admin/sns/", "投稿・予約・履歴"],
  ["Reel制作", "/admin/reels/", "短尺動画の企画・素材・Render"],
  ["AI Media", "/admin/ai-media/", "画像生成・Media Library"],
  ["Growth承認", "/admin/growth/", "改善Action・レポート・承認"],
];

export const metadata = { title: "サイト・管理画面一覧 | Raven Blackwood" };

export default function SitesAdminPage() {
  return <main className="admin-dashboard"><style dangerouslySetInnerHTML={{ __html: css }} /><div className="admin-shell">
    <nav className="admin-nav"><Link className="admin-link" href="/admin/">管理ダッシュボード</Link><Link className="admin-logout" href="/api/admin/auth/logout">ログアウト</Link></nav>
    <header className="admin-hero"><p className="admin-kicker">StudioOS Directory</p><h1 className="admin-title">サイト・管理画面一覧</h1><p className="admin-lead">ギルドメンバーの公開サイトと、Raven公式サイトの主要管理画面をまとめています。リンク先の表示・権限・公開状態は各サービス側の最新状態を確認してください。</p></header>
    <section className="directory-section"><div className="section-heading"><p className="admin-kicker">Member Sites</p><h2>ギルドメンバーサイト</h2></div><div className="directory-grid">{memberSites.map((site) => <a className="directory-card" href={site.url} target="_blank" rel="noreferrer" key={site.name}><span className="directory-role">{site.role}</span><h3>{site.name}</h3><p>{site.note}</p><span className="directory-url">{site.url}</span></a>)}</div></section>
    <section className="directory-section"><div className="section-heading"><p className="admin-kicker">Core Admin</p><h2>核となる管理画面</h2></div><div className="directory-grid">{adminLinks.map(([name, href, note]) => <Link className="directory-card" href={href} rel="nofollow" key={href}><span className="directory-role">Raven Admin</span><h3>{name}</h3><p>{note}</p><span className="directory-url">{href}</span></Link>)}</div></section>
    <section className="directory-note"><strong>運用上の注意</strong><p>この一覧は導線をまとめるためのものです。サイト削除、DNS変更、Worker変更、データ変更はこのページから実行しません。</p></section>
  </div></main>;
}

const css = `.admin-dashboard{min-height:100vh;background:#f5f0e8;color:#20241f;padding:32px 20px;font-family:Arial,Helvetica,sans-serif}.admin-shell{max-width:1120px;margin:0 auto}.admin-nav{display:flex;align-items:center;justify-content:space-between;gap:12px}.admin-link,.admin-logout{color:#596d51;font-size:14px;font-weight:700;text-decoration:none}.admin-logout{border:1px solid #cbbfac;background:#fff;padding:8px 12px}.admin-hero{margin-top:20px;border-bottom:1px solid #d7cabc;padding-bottom:24px}.admin-kicker{margin:0;color:#6c5f3d;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.admin-title{margin:8px 0 0;font-size:40px;line-height:1.15}.admin-lead{max-width:820px;margin:12px 0 0;color:#5e625c;line-height:1.8}.directory-section{margin-top:28px}.section-heading h2{margin:6px 0 16px;font-size:28px}.directory-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.directory-card{display:block;border:1px solid #d7cabc;background:#fffaf2;padding:18px;color:#20241f;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}.directory-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(64,55,42,.1)}.directory-role{color:#6c5f3d;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.directory-card h3{margin:8px 0 0;font-size:20px}.directory-card p{margin:7px 0 0;color:#5e625c;line-height:1.6}.directory-url{display:block;margin-top:12px;overflow-wrap:anywhere;color:#596d51;font-size:12px}.directory-note{margin-top:26px;border:1px solid #d7cabc;background:#fffaf2;padding:18px;color:#5e625c;line-height:1.7}.directory-note strong{color:#20241f}.directory-note p{margin:7px 0 0}@media(max-width:800px){.directory-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.admin-dashboard{padding:24px 16px}.admin-title{font-size:32px}.directory-grid{grid-template-columns:1fr}}`;
