import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import app from "../src/worker";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = read("src/worker.tsx");
const client = read("public/app.js");
const css = read("public/styles.css");
const migration = read("migrations/0001_telemetry.sql");
const surface = `${worker}\n${client}`;
const origin = "https://kyushoku-nenrei.yhay81.com";
const bindings = {
  ASSETS: {} as Fetcher,
  DB: {
    prepare: () => ({
      bind: () => ({ run: async () => ({ success: true }) }),
      first: async () => ({ ok: 1 }),
    }),
  } as unknown as D1Database,
};

describe("product surface", () => {
  it("communicates age composition with drawers, bands, bars, and trends", () => {
    expect(worker).toContain('class="age-drawer"');
    expect(worker).toContain('class="age-bins"');
    expect(client).toContain('class="distribution-bar"');
    expect(client).toContain('class="age-rows"');
    expect(client).toContain('class="sparkline"');
    expect(css.toLowerCase()).not.toContain("gradient");
  });

  it("keeps data exploration and four comparison ids in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain('fetch("/data/jobseekers.json")');
    expect(client).toContain("localStorage");
    expect(client).toContain("MAX_COMPARE = 4");
    expect(client).toContain("slice(0, MAX_COMPARE)");
    expect(migration).not.toMatch(
      /prefecture_(?:name|id)|query_(?:text|value)|search_term|metric_value|year_value|age_value|email|phone/iu,
    );
  });

  it("states aggregation, sex-total, and interpretation boundaries", () => {
    expect(worker).toContain("公式Excelの性計だけを使い");
    expect(worker).toContain("同じ人が複数月に含まれることがあります");
    expect(worker).toContain("個人の年齢や就職しやすさは分かりません");
    expect(worker).toContain("年代ごとの能力や適性、地域の優劣を表しません");
    expect(worker).toContain("公共データ利用規約 第1.0版");
    expect(worker).toContain("https://www.mhlw.go.jp/toukei/list/xls/114-1d-03.xlsx");
  });

  it("renders four indexable pages with constrained typography and no meta copy", async () => {
    for (const path of ["/", "/guide", "/source", "/privacy"]) {
      const response = await app.request(`${origin}${path}`, undefined, bindings);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<html lang="ja">');
    }
    expect(css).toContain("2.35rem");
    expect(css).not.toMatch(/font-size:\s*(?:[4-9]|\d{2,})rem/iu);
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });

  it("accepts only same-origin allowlisted telemetry", async () => {
    const accepted = await app.request(
      `${origin}/api/telemetry`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          "x-kyushoku-nenrei-session": "12345678-1234-4123-8123-123456789abc",
          "x-kyushoku-nenrei-qa": "1",
        },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    const invalid = await app.request(
      `${origin}/api/telemetry`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "unknown" }),
      },
      bindings,
    );
    const foreign = await app.request(
      `${origin}/api/telemetry`,
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.com" },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    expect(accepted.status).toBe(202);
    expect(invalid.status).toBe(400);
    expect(foreign.status).toBe(403);
  });

  it("separates QA, honors privacy signals, and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain("navigator.doNotTrack");
    expect(client).toContain("globalPrivacyControl");
    expect(client).toContain('"x-kyushoku-nenrei-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
});
