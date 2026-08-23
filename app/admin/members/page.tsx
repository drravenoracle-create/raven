import { env } from "cloudflare:workers";
import Link from "next/link";
import { guildMemberRequest } from "../../lib/guild-member-client";

export const dynamic = "force-dynamic";

type Member = { id?: string; email?: string; display_name?: string; email_verified?: number; created_at?: string; entitlements?: { menu_id?: string; quota?: number; used_count?: number }[]; reading_count?: number };
type Reading = { id?: string; member_id?: string; display_name?: string; menu_id?: string; character_id?: string; reading_mode?: string; is_trial?: number; created_at?: string };
type Overview = { members: Member[]; readings: Reading[]; totals: { members?: number; readings?: number; trial_remaining?: number }; error?: string };

async function loadOverview(): Promise<Overview> {
  try {
    const payload = await guildMemberRequest<{ members?: Member[]; readings?: Reading[]; totals?: { members?: number; readings?: number; trial_remaining?: number } }>(env, "/api/admin/overview");
    return { members: payload.members || [], readings: payload.readings || [], totals: payload.totals || {} };
  } catch (error) {
    return { members: [], readings: [], totals: {}, error: error instanceof Error ? error.message : "会員データを取得できません。" };
  }
}

function date(value?: string) { return value ? value.replace("T", " ").slice(0, 16) : "未設定"; }

export default async function MembersAdminPage() {
  const data = await loadOverview();
  const members = data.members || [];
  const readings = data.readings || [];
  return <main className="admin-dashboard"><style dangerouslySetInnerHTML={{ __html: css }} /><div className="admin-shell">
    <nav className="admin-nav"><Link className="admin-link" href="/admin/">管理ダッシュボード</Link><Link className="admin-logout" href="/api/admin/auth/logout">ログアウト</Link></nav>
    <header className="admin-hero"><p className="admin-kicker">Guild Member Core</p><h1 className="admin-title">会員管理</h1><p className="admin-lead">会員情報、トライアル残数、鑑定履歴を読み取り専用で確認します。</p></header>
    {data.error ? <section className="admin-alert"><strong>会員Coreに接続できません</strong><p>{data.error}</p></section> : null}
    <section className="admin-summary"><Stat label="会員数" value={data.totals?.members ?? members.length} note="Guild Member Core" /><Stat label="鑑定履歴" value={data.totals?.readings ?? readings.length} note="全体" /><Stat label="トライアル残数" value={data.totals?.trial_remaining ?? "未取得"} note="合計" /></section>
    <section className="admin-panel table-wrap"><h2>会員一覧</h2><table><thead><tr><th>表示名</th><th>メール</th><th>認証</th><th>登録日</th><th>鑑定数</th><th>トライアル</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td>{member.display_name || "未設定"}</td><td>{member.email || "非公開"}</td><td>{member.email_verified ? "確認済み" : "未確認"}</td><td>{date(member.created_at)}</td><td>{member.reading_count ?? 0}</td><td>{(member.entitlements || []).map((item) => `${item.menu_id || "trial"}: ${Math.max(0, Number(item.quota || 0) - Number(item.used_count || 0))}`).join(" / ") || "なし"}</td></tr>)}{!members.length ? <tr><td colSpan={6}>表示できる会員データがありません。</td></tr> : null}</tbody></table></section>
    <section className="admin-panel table-wrap"><h2>全体鑑定履歴</h2><table><thead><tr><th>日時</th><th>会員</th><th>メニュー</th><th>キャラクター</th><th>モード</th><th>種別</th></tr></thead><tbody>{readings.map((reading) => <tr key={reading.id}><td>{date(reading.created_at)}</td><td>{reading.display_name || reading.member_id || "非表示"}</td><td>{reading.menu_id || "未設定"}</td><td>{reading.character_id || "未設定"}</td><td>{reading.reading_mode || "未設定"}</td><td>{reading.is_trial ? "トライアル" : "通常"}</td></tr>)}{!readings.length ? <tr><td colSpan={6}>表示できる鑑定履歴がありません。</td></tr> : null}</tbody></table></section>
  </div></main>;
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) { return <div className="admin-stat"><p>{label}</p><strong>{value}</strong><span>{note}</span></div>; }
const css = `.admin-dashboard{min-height:100vh;background:#f5f0e8;color:#20241f;padding:32px 20px;font-family:Arial,Helvetica,sans-serif}.admin-shell{max-width:1120px;margin:0 auto}.admin-nav{display:flex;justify-content:space-between;gap:12px}.admin-link,.admin-logout{color:#596d51;font-size:14px;font-weight:700;text-decoration:none}.admin-logout{border:1px solid #cbbfac;background:#fff;padding:8px 12px}.admin-hero{margin-top:20px;border-bottom:1px solid #d7cabc;padding-bottom:24px}.admin-kicker{margin:0;color:#6c5f3d;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.admin-title{margin:8px 0 0;font-size:40px}.admin-lead{color:#5e625c;line-height:1.8}.admin-alert,.admin-panel{border:1px solid #d7cabc;background:#fffaf2;padding:20px;margin-top:20px}.admin-alert{border-color:#b98043}.admin-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px}.admin-stat{border:1px solid #d7cabc;background:#fffaf2;padding:20px}.admin-stat p,.admin-stat span{margin:0;color:#6c5f3d;font-size:14px;font-weight:700}.admin-stat strong{display:block;margin:8px 0;font-size:28px}.table-wrap{overflow-x:auto}.table-wrap h2{margin:0 0 14px;font-size:24px}table{width:100%;border-collapse:collapse;background:#fff;min-width:760px}th,td{border:1px solid #e1d6c8;padding:10px;text-align:left;font-size:13px;vertical-align:top}th{background:#f5f0e8;color:#6c5f3d}@media(max-width:640px){.admin-dashboard{padding:24px 16px}.admin-title{font-size:32px}.admin-summary{grid-template-columns:1fr}}`;
