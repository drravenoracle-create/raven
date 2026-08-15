import FreeFortuneClient from "./FreeFortuneClient";

export const metadata = {
  title: "AI無料占い | レイヴン・ブラックウッド",
  description:
    "今日、恋愛・相性、仕事、金運、易断から選び、レイヴン・ブラックウッドの視点で今の流れと次の一手を無料で確認できます。",
};

export default function FreeFortunePage() {
  return <FreeFortuneClient />;
}
