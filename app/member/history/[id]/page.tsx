import HistoryDetailClient from "./HistoryDetailClient";

export const metadata = {
  title: "鑑定履歴詳細 | レイヴン・ブラックウッド",
};

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HistoryDetailClient id={id} />;
}
