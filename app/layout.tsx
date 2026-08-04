import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "レイヴン・オラクル テキスト鑑定",
  description:
    "レイヴン・オラクルのAIテキスト鑑定と時間制チャット。文章の温度、意図、リスク、次の一手を整理します。",
  openGraph: {
    title: "レイヴン・オラクル テキスト鑑定",
    description:
      "文章の温度、意図、リスク、次の一手をレイヴン・オラクルの視点で整理します。",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
