import MemberPageClient from "./MemberPageClient";

export const metadata = {
  title: "ギルド共通マイページ | レイヴン・ブラックウッド",
  description: "レイヴン・ブラックウッドの鑑定履歴、無料トライアル、ギルド共通アカウントの入口です。",
};

export default function MemberPage() {
  return <MemberPageClient />;
}
