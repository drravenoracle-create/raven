import { env } from "cloudflare:workers";
import Link from "next/link";

const TENANT_ID = "raven-oracle";

const items = [
  { href: "/admin/growth/", title: "Growth Engine", label: "成長管理", description: "検索、SNS、CTA、予約、購入までの計測と改善アクションを確認します。" },
  { href: "/admin/blog/", title: "Blog Engine", label: "ブログ運用", description: "記事案、下書き、SEO、SNS派生、品質レビューを管理します。" },
  { href: "/admin/reels/", title: "Reel Engine", label: "リール制作", description: "縦型ショート動画の企画、台本、素材、Render、SNS下書き連携を管理します。" },
  { href: "/admin/decks/", title: "Deck Manager", label: "カード管理", description: "デッキ、カード画像参照、意味データ、SNS利用可否、カード選出と利用履歴を管理します。" },
  { href: "/admin/sns/", title: "SNS Engine", label: "SNS運用", description: "Instagram投稿、キャプション、Reels台本、予約、投稿履歴を管理します。" },
  { href: "/admin/analytics/", title: "アクセス分析", label: "分析", description: "イベント計測、流入、KPI、改善メモを確認します。" },
];

type CountRow = { status: string; count: number };
type LatestArticle = { title?: string; status?: string; category?: string; created_at?: string };
type SnsPost = { title?: string; platform?: string; post_type?: string; status?: string; scheduled_at?: string; created_at?: string };
type ActionRow = { action_type?: string; channel?: string; risk_level?: string; status?: string; created_at?: string };
type ReportRow = { summary?: string; status?: string; created_at?: string };
type ConnectorRow = { source?: string; provider?: string; enabled?: number; sync_status?: string; last_success_at?: string };

export const metadata = { title: "管理ダッシュボード | Raven Blackwood" };

async function loadOverview() {
  try {
    const [blogCounts, snsCounts, reelCounts, articles, snsPosts, actions, reports, connectors] = await Promise.all([
      env.DB.prepare("SELECT status, COUNT(*) AS count FROM blog_engine_articles WHERE tenant_id = ? GROUP BY status").bind(TENANT_ID).all<CountRow>(),
      env.DB.prepare("SELECT status, COUNT(*) AS count FROM sns_posts WHERE tenant_id = ? GROUP BY status").bind(TENANT_ID).all<CountRow>(),
      env.DB.prepare("SELECT status, COUNT(*) AS count FROM reel_projects WHERE tenant_id = ? GROUP BY status").bind(TENANT_ID).all<CountRow>(),
      env.DB.prepare("SELECT title, status, category, created_at FROM blog_engine_articles WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 4").bind(TENANT_ID).all<LatestArticle>(),
      env.DB.prepare("SELECT title, platform, post_type, status, scheduled_at, created_at FROM sns_posts WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 4").bind(TENANT_ID).all<SnsPost>(),
      env.DB.prepare("SELECT action_type, channel, risk_level, status, created_at FROM growth_autonomous_actions WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 4").bind(TENANT_ID).all<ActionRow>(),
      env.DB.prepare("SELECT summary, status, created_at FROM growth_executive_reports WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 2").bind(TENANT_ID).all<ReportRow>(),
      env.DB.prepare("SELECT source, provider, enabled, sync_status, last_success_at FROM growth_data_connectors WHERE tenant_id = ? ORDER BY source").bind(TENANT_ID).all<ConnectorRow>(),
    ]);
    const total = (rows: CountRow[] = []) => rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    const byStatus = (rows: CountRow[] = [], status: string) => rows.find((row) => row.status === status)?.count || 0;
    const actionRows = actions.results || [];
    return {
      blogTotal: total(blogCounts.results || []),
      blogDrafts: byStatus(blogCounts.results || [], "draft"),
      snsTotal: total(snsCounts.results || []),
      snsScheduled: byStatus(snsCounts.results || [], "scheduled"),
      reelTotal: total(reelCounts.results || []),
      approval: actionRows.filter((item) => item.status === "queued" || item.status === "pending").length,
      articles: articles.results || [],
      snsPosts: snsPosts.results || [],
      actions: actionRows,
      reports: reports.results || [],
      connectors: connectors.results || [],
    };
  } catch {
    return { blogTotal: 0, blogDrafts: 0, snsTotal: 0, snsScheduled: 0, reelTotal: 0, approval: 0, articles: [], snsPosts: [], actions: [], reports: [], connectors: [] };
  }
}

function date(value?: string) {
  return value ? value.replace("T", " ").slice(0, 16) : "未設定";
}

export default async function AdminPage() {
  const data = await loadOverview();
  return (
    <main className="admin-dashboard">
      <style dangerouslySetInnerHTML={{ __html: adminCss }} />
      <div className="admin-shell">
        <nav className="admin-nav"><Link className="admin-link" href="/">Raven Blackwood</Link><Link className="admin-logout" href="/api/admin/auth/logout" rel="nofollow">ログアウト</Link></nav>
        <header className="admin-hero"><p className="admin-kicker">Raven Oracle Admin</p><h1 className="admin-title">管理ダッシュボード</h1><p className="admin-lead">Blog Engine、SNS Engine、Reel Engine、Growth Engine、アクセス分析をまとめて確認します。外部Provider未接続の数値は実測扱いにしません。</p></header>
        <section className="admin-summary" aria-label="運用サマリー"><Stat label="Blog記事" value={data.blogTotal} note={`下書き ${data.blogDrafts}`} /><Stat label="SNS投稿" value={data.snsTotal} note={`予約 ${data.snsScheduled}`} /><Stat label="Reel" value={data.reelTotal} note="企画数" /><Stat label="承認待ち" value={data.approval} note="Growth Action" /><Stat label="連携" value={data.connectors.length} note="Provider状態" /></section>
        <section className="admin-workspace"><div className="admin-panel"><h2>今日見るところ</h2><p className="admin-muted">直近の生成物、予約、改善Actionです。ここを見れば運用の詰まりが分かるようにしています。</p><div className="admin-list">{data.reports[0] ? <Row title="最新Growthレポート" meta={`${data.reports[0].status || "status未設定"} / ${date(data.reports[0].created_at)}`} body={data.reports[0].summary || "要約未作成"} /> : <Row title="Growthレポート未作成" meta="Executive Report" body="Growth Engineでレポートを生成するとここに表示されます。" />}{data.articles.map((item, index) => <Row key={`article-${index}`} title={item.title || "無題の記事"} meta={`${item.status || "unknown"} / ${item.category || "カテゴリ未設定"}`} body={date(item.created_at)} />)}{data.snsPosts.map((item, index) => <Row key={`sns-${index}`} title={item.title || "無題のSNS投稿"} meta={`${item.status || "unknown"} / ${item.platform || "sns"} / ${item.post_type || "post"}`} body={`予定 ${date(item.scheduled_at || item.created_at)}`} />)}{!data.articles.length && !data.snsPosts.length ? <Row title="運用データ待ち" meta="No data" body="記事生成やSNS下書きを作ると、ここに表示されます。" /> : null}</div></div><aside className="admin-panel"><h2>クイック操作</h2><div className="admin-actions"><Link href="/admin/blog/" rel="nofollow">ブログ下書きを作成<span>13時下書き、17時公開の運用を確認</span></Link><Link href="/admin/reels/" rel="nofollow">Reel企画を作成<span>短尺動画の台本、素材、SNS下書き連携を確認</span></Link><Link href="/admin/sns/" rel="nofollow">SNS投稿作成<span>Instagram投稿、Reels台本、予約を確認</span></Link><Link href="/admin/growth/" rel="nofollow">Growth承認確認<span>改善Action、レポート、リスクを見る</span></Link><Link href="/admin/analytics/" rel="nofollow">アクセス分析<span>イベントとKPIから次の一手を整理</span></Link></div></aside></section>
        <section className="admin-menu" aria-label="管理メニュー">{items.map((item) => <Link key={item.href} className="admin-card" href={item.href} rel="nofollow"><div className="admin-card-head"><div><p>{item.label}</p><h2>{item.title}</h2></div><span>開く</span></div><p className="admin-card-text">{item.description}</p></Link>)}</section>
      </div>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) { return <div className="admin-stat"><p>{label}</p><strong>{value}</strong><span>{note}</span></div>; }
function Row({ title, meta, body }: { title: string; meta: string; body: string }) { return <article className="admin-row"><p className="admin-row-meta">{meta}</p><h3>{title}</h3><p>{body}</p></article>; }

const adminCss = `
.admin-dashboard{min-height:100vh;background:#f5f0e8;color:#20241f;padding:32px 20px;font-family:Arial,Helvetica,sans-serif}.admin-shell{max-width:1120px;margin:0 auto}.admin-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.admin-link,.admin-logout{color:#596d51;font-size:14px;font-weight:700;text-decoration:none}.admin-logout{border:1px solid #cbbfac;background:#fff;padding:8px 12px}.admin-hero{margin-top:20px;border-bottom:1px solid #d7cabc;padding-bottom:24px}.admin-kicker{margin:0;color:#6c5f3d;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.admin-title{margin:8px 0 0;font-size:40px;line-height:1.15;font-weight:700}.admin-lead{max-width:820px;margin:12px 0 0;color:#5e625c;line-height:1.8}.admin-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:24px}.admin-stat,.admin-card,.admin-panel{border:1px solid #d7cabc;background:#fffaf2;padding:20px}.admin-stat p{margin:0;color:#6c5f3d;font-size:14px;font-weight:700}.admin-stat strong{display:block;margin-top:8px;font-size:26px;line-height:1.2}.admin-stat span{display:block;margin-top:8px;color:#5e625c;font-size:13px}.admin-workspace{display:grid;grid-template-columns:1.25fr .75fr;gap:16px;margin-top:24px}.admin-panel h2{margin:0;font-size:24px}.admin-muted{margin:8px 0 0;color:#5e625c;line-height:1.7}.admin-list{display:grid;gap:10px;margin-top:16px}.admin-row{border:1px solid #e1d6c8;background:#fff;padding:12px}.admin-row h3{margin:4px 0 0;font-size:16px}.admin-row p{margin:6px 0 0;color:#5e625c;line-height:1.6}.admin-row-meta{margin:0!important;color:#6c5f3d!important;font-size:12px!important;font-weight:700}.admin-actions{display:grid;gap:10px;margin-top:16px}.admin-actions a{display:block;border:1px solid #cbbfac;background:#fff;color:#20241f;padding:12px;text-decoration:none;font-weight:700}.admin-actions span{display:block;margin-top:4px;color:#5e625c;font-size:13px;font-weight:400;line-height:1.5}.admin-menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:24px}.admin-card{display:block;color:inherit;text-decoration:none}.admin-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.admin-card-head p{margin:0;color:#6c5f3d;font-size:14px;font-weight:700}.admin-card-head h2{margin:4px 0 0;font-size:26px;line-height:1.2}.admin-card-head span{background:#222820;color:#fff8ed;padding:8px 14px;font-size:14px;font-weight:700}.admin-card-text{margin:16px 0 0;color:#5e625c;line-height:1.8}@media(max-width:900px){.admin-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-workspace,.admin-menu{grid-template-columns:1fr}}@media(max-width:560px){.admin-dashboard{padding:24px 16px}.admin-title{font-size:32px}.admin-summary{grid-template-columns:1fr}}
`;
