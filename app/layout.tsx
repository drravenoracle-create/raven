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

const title = "Raven Oracle AI\u7121\u6599\u5360\u3044";
const description = "Raven Oracle\u306e\u7121\u6599AI\u5360\u3044\u3002\u540d\u524d\u3068\u30c6\u30fc\u30de\u304b\u3089\u4eca\u65e5\u306e\u6d41\u308c\u3068\u5c0f\u3055\u306a\u958b\u904b\u30a2\u30c9\u30d0\u30a4\u30b9\u3092\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002AI\u30c6\u30ad\u30b9\u30c8\u9451\u5b9a\u306fComing soon\u3067\u3059\u3002";

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