import { env } from "cloudflare:workers";
import Link from "next/link";
import { deriveOpeningCampaignState, loadOpeningCampaignConfig } from "../../lib/opening-campaign";
import { RAVEN_TENANT_CONFIG } from "../../lib/tenant-config";

export const metadata = { title: "Opening Campaign | Raven Admin" };

export default async function OpeningCampaignAdminPage() {
  const config = await loadOpeningCampaignConfig(env.DB, RAVEN_TENANT_CONFIG);
  let counts: Array<{ event_name: string; count: number }> = [], usage = 0, conversions = 0;
  try {
    const events = await env.DB.prepare("SELECT event_name, COUNT(*) AS count FROM opening_campaign_events WHERE campaign_id = ? GROUP BY event_name").bind(config.campaignId).all<{ event_name: string; count: number }>();
    counts = events.results || [];
    const members = await env.DB.prepare("SELECT COALESCE(SUM(trial_used_count), 0) AS usage, SUM(CASE WHEN trial_status = 'converted' THEN 1 ELSE 0 END) AS conversions FROM opening_campaign_members WHERE campaign_id = ?").bind(config.campaignId).first<{ usage: number; conversions: number }>();
    usage = Number(members?.usage || 0); conversions = Number(members?.conversions || 0);
  } catch {}
  const state = deriveOpeningCampaignState({ config, usedCount: usage });
  return <main className="admin-dashboard"><div className="admin-shell"><nav className="admin-nav"><Link className="admin-link" href="/admin/">管理ダッシュボード</Link></nav><header className="admin-hero"><p className="admin-kicker">Opening Campaign</p><h1 className="admin-title">キャンペーン確認</h1><p className="admin-lead">Phase 1は読み取り確認のみです。本番の有効化やTrial設定変更は行いません。</p></header><section className="admin-summary"><div className="admin-stat"><p>Feature Flag</p><strong>{config.enabled ? "ON" : "OFF"}</strong><span>初期状態はOFF</span></div><div className="admin-stat"><p>状態</p><strong>{state}</strong><span>{config.campaignName}</span></div><div className="admin-stat"><p>Trial設定</p><strong>{config.trialEnabled ? "有効" : "無効"}</strong><span>上限 {config.trialLimit}</span></div><div className="admin-stat"><p>利用数</p><strong>{usage}</strong><span>opening_campaign_members</span></div><div className="admin-stat"><p>Conversion</p><strong>{conversions}</strong><span>Trialからの転換</span></div></section><section className="admin-panel" style={{ marginTop: 24 }}><h2>設定</h2><p className="admin-muted">開始: {config.startAt || "未設定"} / 終了: {config.endAt || "未設定"}</p><p className="admin-muted">対象: {config.targetAudience} / scope: {config.trialScope}</p><h2 style={{ marginTop: 24 }}>イベント</h2>{counts.length ? counts.map((item) => <p className="admin-muted" key={item.event_name}>{item.event_name}: {item.count}</p>) : <p className="admin-muted">イベントはまだありません。</p>}</section></div></main>;
}
