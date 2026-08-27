import Link from "next/link";

const links = [
  ["/guild/", "ギルド"],
  ["/divination-methods/", "占術"],
  ["/blog/", "読みもの"],
  ["/faq/", "FAQ"],
] as const;

export function PublicSiteHeader() {
  return (
    <header className="raven-site-header">
      <div className="raven-site-header-inner">
        <Link className="raven-brand" href="/">
          <span className="raven-brand-mark" aria-hidden="true">R</span>
          <span><strong>レイヴン・ブラックウッド</strong><small>古典占術の鑑定室</small></span>
        </Link>
        <nav aria-label="メインナビゲーション">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          <Link className="raven-header-cta" href="/text-reading/">相談をはじめる</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicSiteFooter() {
  return (
    <footer className="raven-site-footer">
      <div>
        <p className="raven-site-footer-title">レイヴン・ブラックウッド</p>
        <p>迷いを整理し、現実に戻り、次の一手を選ぶための鑑定室。</p>
      </div>
      <nav aria-label="フッターナビゲーション">
        <Link href="/text-reading/">AIテキスト占い</Link>
        <Link href="/free-fortune/">AI無料占い</Link>
        <Link href="/member/">マイページ</Link>
        <Link href="/privacy/">個人情報保護方針</Link>
      </nav>
    </footer>
  );
}
