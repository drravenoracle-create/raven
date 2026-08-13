import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "レイヴン・ブラックウッド";
const description = "レイヴン・ブラックウッドの鑑定サイト。自己紹介、ギルドメンバー紹介、AI無料占い、FAQ、各種ポリシーを掲載しています。";
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const tenantId = "raven-oracle";
const commonAnalyticsEndpoint = "https://fortunestudios.jp/api/public/analytics/events";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      {gaMeasurementId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}');
            `}
          </Script>
        </>
      ) : null}
      <Script id="d1-analytics" strategy="afterInteractive">
        {`
          (function(){
            const tenantId = "${tenantId}";
            const endpoints = ["/api/analytics/event", "${commonAnalyticsEndpoint}"];
            const params = new URLSearchParams(window.location.search);
            const clean = function(value, max) {
              return String(value || "").replace(/\\s+/g, " ").trim().slice(0, max);
            };
            const post = function(endpoint, body) {
              if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }))) {
                return;
              }
              fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(function(){});
            };
            const send = function(eventName, extra) {
              const payload = Object.assign({
                tenantId,
                eventName,
                pagePath: window.location.pathname,
                pageTitle: document.title,
                referrer: document.referrer,
                source: params.get("utm_source") || "",
                medium: params.get("utm_medium") || "",
                campaign: params.get("utm_campaign") || ""
              }, extra || {});
              const body = JSON.stringify(payload);
              endpoints.forEach(function(endpoint) { post(endpoint, body); });
            };
            send("page_view");
            document.addEventListener("click", function(event) {
              const anchor = event.target instanceof Element ? event.target.closest("a") : null;
              if (!anchor || anchor.closest("nav")) return;
              send(anchor.dataset.analyticsEvent || "raven_primary_action", {
                linkUrl: clean(anchor.href, 500),
                linkText: clean(anchor.textContent, 160),
                eventTarget: clean(anchor.href, 500),
                eventLabel: clean(anchor.textContent, 160)
              });
            }, { capture: true });
            window.ravenAnalytics = { track: send };
          })();
        `}
      </Script>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}



