import MemberPageClient from "./MemberPageClient";

export const metadata = {
  title: "ギルド共通マイページ | レイヴン・ブラックウッド",
  description: "レイヴン・ブラックウッドの鑑定結果を保存し、次回からスムーズに利用するための会員ページです。",
};

export default function MemberPage() {
  return <MemberPageClient />;
}
