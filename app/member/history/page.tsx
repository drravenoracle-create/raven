import HistoryPageClient from "./HistoryPageClient";

export const metadata = {
  title: "鑑定履歴 | レイヴン・ブラックウッド",
  description: "ギルド共通アカウントに紐づくレイヴンの鑑定履歴です。",
};

export default function HistoryPage() {
  return <HistoryPageClient />;
}
