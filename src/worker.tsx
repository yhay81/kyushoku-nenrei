import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://kyushoku-nenrei.yhay81.com";
const dataPage = "https://www.mhlw.go.jp/toukei/list/114-1d.html";
const sourceWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-03.xlsx";
const termsPage = "https://www.mhlw.go.jp/toukei/itiran/roudou/koyou/ippan/detail/01.html";
const useTerms = "https://www.mhlw.go.jp/chosakuken/index.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "region_changed",
  "sort_changed",
  "employment_changed",
  "metric_changed",
  "year_changed",
  "age_changed",
  "compared",
  "copied",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (Number(c.req.header("content-length") ?? "0") > 512)
    throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-kyushoku-nenrei-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-kyushoku-nenrei-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "年代構成" },
  { href: "/guide", label: "数字の見方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#304238" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="求職年齢くらべ ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>求職年齢くらべ</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>求職年齢くらべ</strong>
          <p>厚生労働省「職業安定業務統計 雇用関係指標」を加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/kyushoku-nenrei">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const AgeDrawerFigure = () => (
  <div aria-label="11の年代別引き出しに求職者の構成を並べた図" class="age-drawer" role="img">
    <div class="drawer-label">
      <span>全国 · 2025年度</span>
      <strong>月間有効求職者</strong>
    </div>
    <div class="age-bins" aria-hidden="true">
      <i class="bin-19">
        <span>〜19</span>
      </i>
      <i class="bin-24">
        <span>20</span>
      </i>
      <i class="bin-29">
        <span>25</span>
      </i>
      <i class="bin-34">
        <span>30</span>
      </i>
      <i class="bin-39">
        <span>35</span>
      </i>
      <i class="bin-44">
        <span>40</span>
      </i>
      <i class="bin-49">
        <span>45</span>
      </i>
      <i class="bin-54">
        <span>50</span>
      </i>
      <i class="bin-59">
        <span>55</span>
      </i>
      <i class="bin-64">
        <span>60</span>
      </i>
      <i class="bin-65">
        <span>65+</span>
      </i>
    </div>
    <div class="drawer-total">
      <span>年代計</span>
      <b>22,698,922</b>
      <small>パートを含む常用 · 延べ</small>
    </div>
    <div class="drawer-note">
      <b>65歳以上</b>
      <span>15.1%</span>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="ハローワーク求職者の11年代構成を、全国・47労働局、2011〜2025年度、就業形態、新規・有効から選び、最大4地域で比較できます。"
    title="都道府県別の求職者年代構成を比較 | 求職年齢くらべ"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="period-label">2011—2025年度 · ハローワーク</p>
          <h1>求職者の年代構成を、地域と年度で。</h1>
          <p class="lead">11の年代帯を同じ条件で並べ、人数と構成比の変化を追えます。</p>
          <div aria-label="収録内容" class="hero-facts">
            <span>
              <b>48</b> 全国・労働局
            </span>
            <span>
              <b>11</b> 年代区分
            </span>
            <span>
              <b>最大4</b> 地域比較
            </span>
          </div>
        </div>
        <AgeDrawerFigure />
      </section>

      <section aria-labelledby="compare-title" class="compare-panel">
        <div class="section-heading compare-heading">
          <div>
            <p class="section-kicker">選択した地域</p>
            <h2 id="compare-title">年代の山と推移</h2>
          </div>
          <div class="compare-actions">
            <span id="compare-count">0 / 4</span>
            <button disabled id="copy-compare" type="button">
              比較をコピー
            </button>
          </div>
        </div>
        <div class="metric-controls">
          <label>
            <span>就業形態</span>
            <select id="employment">
              <option value="all">パートを含む常用</option>
              <option value="full">パートを除く常用</option>
              <option value="part">常用的パート</option>
            </select>
          </label>
          <label>
            <span>指標</span>
            <select id="metric">
              <option value="active">月間有効求職者数</option>
              <option value="new">新規求職申込件数</option>
            </select>
          </label>
          <label>
            <span>年度</span>
            <select id="year" />
          </label>
          <label>
            <span>注目する年代</span>
            <select id="age-focus" />
          </label>
        </div>
        <p class="metric-note" id="metric-note">
          月間有効求職者数の年度値は月ごとの延べ人数です。同じ人が複数月に含まれることがあります。
        </p>
        <div class="empty-compare" id="compare-list">
          一覧の「比較に追加」から、2〜4地域を選んでください。
        </div>
      </section>

      <section aria-labelledby="finder-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="section-kicker">地域一覧</p>
            <h2 id="finder-title">都道府県を選ぶ</h2>
          </div>
          <p id="data-status" role="status">
            公式表を読み込んでいます
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>都道府県・全国</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：東京、福岡、全国"
              type="search"
            />
          </label>
          <label>
            <span>地域</span>
            <select id="region">
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">都道府県コード順</option>
              <option value="focus-desc">注目年代の割合が高い順</option>
              <option value="count-desc">注目年代の人数が多い順</option>
              <option value="change-desc">構成比の前年差が大きい順</option>
              <option value="name">名前順</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <h2 id="results-title">年代構成</h2>
          <p>
            <b id="result-count">—</b> 地域
          </p>
        </div>
        <div class="place-grid" id="results" />
      </section>

      <aside class="boundary">
        <span aria-hidden="true">齢</span>
        <div>
          <strong>個人の年齢や就職しやすさは分かりません</strong>
          <p>
            公共職業安定所が扱った集計値です。民間サービスだけの求職者、在職者、就職後の定着、年代ごとの能力や適性、地域の優劣を表しません。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="求職年齢くらべの年代、就業形態、新規求職申込件数、月間有効求職者数、年度計の読み方を説明します。"
    title="数字の見方 | 求職年齢くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">数字の見方</p>
        <h1>人数と構成比を、同じ箱で。</h1>
        <p>同じ労働局・就業形態・指標・年度の年代計を100%として、11年代帯を並べます。</p>
      </div>
      <section class="age-guide">
        <div class="age-guide-strip" aria-label="19歳以下から65歳以上までの11年代区分">
          <i>〜19</i>
          <i>20</i>
          <i>25</i>
          <i>30</i>
          <i>35</i>
          <i>40</i>
          <i>45</i>
          <i>50</i>
          <i>55</i>
          <i>60</i>
          <i>65+</i>
        </div>
        <p>20歳以上64歳以下は5歳刻みです。各年代の件数合計は、公式表の年代計と一致します。</p>
      </section>
      <section class="guide-grid">
        <article>
          <span>年度中の受付</span>
          <h2>新規求職申込件数</h2>
          <p>
            期間中に新たに受け付けた求職申込みの件数です。同じ人の再申込みなど、固有人数とは一致しない場合があります。
          </p>
        </article>
        <article>
          <span>年度計・延べ</span>
          <h2>月間有効求職者数</h2>
          <p>
            前月から繰り越した就職未決定の有効求職者と、その月の新規求職申込みの合計。年度値は12か月分の合計です。
          </p>
        </article>
        <article>
          <span>2020年度から</span>
          <h2>就業形態別</h2>
          <p>
            パートを除く常用と常用的パートは2020年度以降です。両者の合計は、パートを含む常用と一致します。
          </p>
        </article>
      </section>
      <section class="note-panel">
        <h2>性別の内訳は表示しません</h2>
        <p>
          公式表の「性計」は、男性行と女性行の単純合計と一致しません。このサービスは性計を独立した公表値として使い、性別比較を行いません。
        </p>
        <a href={termsPage}>厚生労働省 用語の解説</a>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="求職年齢くらべが利用する厚生労働省の公式Excel、加工内容、検算、確認日、利用条件を示します。"
    title="出典とデータ | 求職年齢くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">出典</p>
        <h1>48地域、3区分、11年代を照合。</h1>
        <p>公式Excelの性計だけを使い、年代合計・全国合計・就業形態合計を検算しています。</p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>厚生労働省</strong>
          <a href={dataPage}>雇用関係指標（年度）</a>
        </div>
        <div>
          <span>公式表</span>
          <strong>第3表 · 求職者数</strong>
          <a href={sourceWorkbook}>公式Excel</a>
        </div>
        <div>
          <span>収録範囲</span>
          <strong>48地域 × 3区分 × 2指標</strong>
          <a href={termsPage}>用語の解説</a>
        </div>
        <div>
          <span>年代</span>
          <strong>11区分 · 性計</strong>
          <span>2011〜2025年度</span>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={useTerms}>厚生労働省の利用規約</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>第3表の3シートから、性計の年代計と11年代帯だけを抽出しました。</li>
          <li>パートを含む常用は2011〜2025年度、他2区分は2020〜2025年度を収録しました。</li>
          <li>
            31,104個の公表値で、正の整数、年代帯合計と年代計、全国計と47労働局合計を確認しました。
          </li>
          <li>
            2020年度以降は、パートを除く常用と常用的パートの合計がパートを含む常用に一致することを確認しました。
          </li>
          <li>労働局名を都道府県名へ短縮し、9地域と全国に分類しました。</li>
          <li>出典：厚生労働省「職業安定業務統計 雇用関係指標（年度）第3表」を加工して作成。</li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>ファイル確認</h2>
        <p>
          2026年8月2日取得。725,785 bytes、SHA-256:
          f04e0ad139667beb9f9fe5113cbf2b06ba7b704bafb4bbfd7f2952b2b7de0164。
        </p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="求職年齢くらべの端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 求職年齢くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">保存</p>
        <h1>選んだ地域は、端末に。</h1>
        <p>検索語、地域名、年代、年度、就業形態、指標をサーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>比較に選んだ公開地域IDを最大4件だけブラウザへ保存します。アカウントは不要です。</p>
        </article>
        <article>
          <h2>操作名だけを計測</h2>
          <p>訪問、検索、0件、条件・並び順の変更、比較追加、コピーの操作名だけを計測します。</p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合は計測しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_payload", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    asOf: "2026-08-02",
    ok: row?.ok === 1,
    records: 31104,
    service: "kyushoku-nenrei",
  });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 求職年齢くらべ"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="section-kicker">404</p>
          <h1>この年代表は見つかりません。</h1>
          <p>
            <a href="/">年代構成の比較へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
