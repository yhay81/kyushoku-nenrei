# 求職年齢くらべ

ハローワーク求職者の11年代構成を、全国・47労働局、2011〜2025年度、就業形態、新規求職・月間有効求職から選び、最大4地域で比較する日本語Webサービスです。

- Production: <https://kyushoku-nenrei.yhay81.com>
- Source: 厚生労働省「一般職業紹介状況（職業安定業務統計）雇用関係指標（年度）」第3表
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:check
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

公式表の性計と11年代帯を収録します。月間有効求職者数の年度値は12か月分の延べ人数で、同じ人が複数月に含まれ得ます。固有人数、民間サービスだけの求職者、能力、適性、就職しやすさ、地域の優劣を示しません。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
