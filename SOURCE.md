# Source and transformation

## Official source

- Provider: 厚生労働省
- Statistics page: <https://www.mhlw.go.jp/toukei/list/114-1d.html>
- Item 3 workbook: <https://www.mhlw.go.jp/toukei/list/xls/114-1d-03.xlsx>
- Definitions: <https://www.mhlw.go.jp/toukei/itiran/roudou/koyou/ippan/detail/01.html>
- Edition: 2011〜2025年度（就業形態別は2020〜2025年度）
- Source verification: 2026-08-02
- Workbook: 725,785 bytes; SHA-256 `f04e0ad139667beb9f9fe5113cbf2b06ba7b704bafb4bbfd7f2952b2b7de0164`
- Terms: 公共データ利用規約（第1.0版）
- Terms page: <https://www.mhlw.go.jp/chosakuken/index.html>

出典：厚生労働省「一般職業紹介状況（職業安定業務統計）雇用関係指標（年度）」第3表を加工して作成。

## Verified dimensions

- 全国と47労働局、48地域
- パートを含む常用は2011〜2025年度の15年度
- パートを除く常用、常用的パートは2020〜2025年度の6年度
- 新規求職申込件数、月間有効求職者数の2指標
- 性計、年代計、11年代帯
- 288系列、31,104個の正整数
- 年代帯合計と年代計の不一致0
- 全国計と47労働局合計の不一致0
- 2020年度以降の`パート除く常用 + 常用的パート = パート含む常用`の不一致0

## Transformation / 加工

1. 第3表の3シートから性計の年代計と11年代帯だけを読み取る。
2. 48地域を公開IDへ対応づけ、労働局名を都道府県名へ短縮して9地域と全国に分類する。
3. 年度、就業形態、指標、年代のすべての公表値を正の整数のまま静的JSONへ変換する。
4. 年代帯合計、全国合計、就業形態合計を検算する。
5. 構成比はブラウザで`年代帯 ÷ 年代計 × 100`として算出し、元件数を併記する。

公式Excelのハッシュが変わった場合は、更新内容を人が確認してから再生成します。

## Interpretation boundary

新規求職申込件数は期間中に新たに受け付けた求職申込みの件数です。月間有効求職者数は前月から繰り越した就職未決定の有効求職者と、その月の新規求職申込みの合計です。年度値は月間値の合計なので固有人数ではありません。公式表の性計は男性行と女性行の単純合計と一致しないため、性計を独立した公表値として使用し、性別比較を提供しません。個人の年齢、能力、適性、就職確率、民間求人サービスの利用者、在職者、地域の雇用環境を示しません。
