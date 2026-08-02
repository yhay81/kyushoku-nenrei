import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Employment = "all" | "full" | "part";
type Metric = "active" | "new";
type RecordRow = {
  p: string;
  e: Employment;
  m: Metric;
  y: number[];
  t: number[];
  a: number[][];
};

const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const records = JSON.parse(
  readFileSync(resolve(root, "public/data/jobseekers.json"), "utf8"),
) as RecordRow[];
const find = (placeId: string, employment: Employment, metric: Metric) =>
  records.find((item) => item.p === placeId && item.e === employment && item.m === metric)!;

describe("official jobseeker age tables", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      schemaVersion: 1,
      asOf: "2026-08-02",
      edition: "2025年度（令和7年度）まで",
      placeCount: 48,
      prefectureCount: 47,
      employmentCount: 3,
      metricCount: 2,
      ageCount: 11,
      seriesCount: 288,
      recordCount: 31_104,
      source: {
        sha256: "f04e0ad139667beb9f9fe5113cbf2b06ba7b704bafb4bbfd7f2952b2b7de0164",
        url: "https://www.mhlw.go.jp/toukei/list/xls/114-1d-03.xlsx",
      },
    });
    expect(index.employments.find((item: { id: string }) => item.id === "all").years).toEqual(
      Array.from({ length: 15 }, (_, i) => 2011 + i),
    );
    expect(index.employments.find((item: { id: string }) => item.id === "full").years).toEqual(
      Array.from({ length: 6 }, (_, i) => 2020 + i),
    );
  });

  it("contains one unique series for every place, employment type, and metric", () => {
    expect(records).toHaveLength(288);
    expect(new Set(records.map((item) => `${item.p}|${item.e}|${item.m}`)).size).toBe(288);
    expect(index.places).toHaveLength(48);
    expect(index.employments).toHaveLength(3);
    expect(index.metrics).toHaveLength(2);
    expect(index.ages).toHaveLength(11);
  });

  it("retains nationwide and known prefecture values for 2025", () => {
    expect(find("00", "all", "active").t.at(-1)).toBe(22_698_922);
    expect(find("00", "all", "active").a.at(-1)?.at(-1)).toBe(3_429_845);
    expect(find("00", "all", "new").t.at(-1)).toBe(4_362_423);
    expect(find("00", "all", "new").a.at(-1)?.at(-1)).toBe(839_847);
    expect(find("13", "full", "active").t.at(-1)).toBe(1_616_226);
    expect(find("13", "full", "active").a.at(-1)?.at(-1)).toBe(104_296);
    expect(find("47", "part", "new").t.at(-1)).toBe(22_706);
    expect(find("47", "part", "new").a.at(-1)?.at(-1)).toBe(6_390);
  });

  it("keeps every age series aligned with its annual total", () => {
    for (const record of records) {
      expect(Object.keys(record).sort()).toEqual(["a", "e", "m", "p", "t", "y"]);
      const expectedLength = record.e === "all" ? 15 : 6;
      expect(record.y).toHaveLength(expectedLength);
      expect(record.t).toHaveLength(expectedLength);
      expect(record.a).toHaveLength(11);
      for (let i = 0; i < expectedLength; i += 1) {
        const ages = record.a.map((series) => series[i]);
        expect(ages.every((value) => Number.isInteger(value) && value > 0)).toBe(true);
        expect(ages.reduce((sum, value) => sum + value, 0)).toBe(record.t[i]);
      }
    }
    expect(statSync(resolve(root, "public/data/jobseekers.json")).size).toBeLessThan(300_000);
  });

  it("keeps nationwide totals equal to all 47 labour bureaus", () => {
    for (const employment of ["all", "full", "part"] as const) {
      for (const metric of ["active", "new"] as const) {
        const rows = records.filter((record) => record.e === employment && record.m === metric);
        const national = rows.find((record) => record.p === "00")!;
        for (let i = 0; i < national.y.length; i += 1) {
          expect(
            rows
              .filter((record) => record.p !== "00")
              .reduce((sum, record) => sum + record.t[i], 0),
          ).toBe(national.t[i]);
        }
      }
    }
  });

  it("keeps all-inclusive employment totals equal to full-time plus part-time", () => {
    for (const place of index.places as { id: string }[]) {
      for (const metric of ["active", "new"] as const) {
        const all = find(place.id, "all", metric);
        const full = find(place.id, "full", metric);
        const part = find(place.id, "part", metric);
        for (const year of full.y) {
          const allIndex = all.y.indexOf(year);
          const detailIndex = full.y.indexOf(year);
          expect(full.t[detailIndex] + part.t[detailIndex]).toBe(all.t[allIndex]);
          for (let age = 0; age < 11; age += 1) {
            expect(full.a[age][detailIndex] + part.a[age][detailIndex]).toBe(all.a[age][allIndex]);
          }
        }
      }
    }
  });
});
