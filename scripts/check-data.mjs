import { readFile } from "node:fs/promises";

const index = JSON.parse(
  await readFile(new URL("../public/data/index.json", import.meta.url), "utf8"),
);
const records = JSON.parse(
  await readFile(new URL("../public/data/jobseekers.json", import.meta.url), "utf8"),
);
if (index.placeCount !== 48 || index.prefectureCount !== 47 || index.ageCount !== 11)
  throw new Error("Unexpected place or age dimensions");
if (
  index.employmentCount !== 3 ||
  index.metricCount !== 2 ||
  index.seriesCount !== 288 ||
  index.recordCount !== 31104
)
  throw new Error("Unexpected index dimensions");
if (records.length !== 288) throw new Error("Unexpected series count");
const placeIds = new Set(index.places.map((item) => item.id));
const employmentIds = new Set(index.employments.map((item) => item.id));
const metricIds = new Set(index.metrics.map((item) => item.id));
const keys = new Set();
for (const record of records) {
  if (!placeIds.has(record.p) || !employmentIds.has(record.e) || !metricIds.has(record.m))
    throw new Error("Unknown dimension");
  const key = `${record.p}|${record.e}|${record.m}`;
  if (keys.has(key)) throw new Error(`Duplicate record: ${key}`);
  keys.add(key);
  const expectedLength = record.e === "all" ? 15 : 6;
  if (
    record.y.length !== expectedLength ||
    record.t.length !== expectedLength ||
    record.a.length !== 11
  )
    throw new Error(`${key}: invalid shape`);
  if (record.a.some((series) => series.length !== expectedLength))
    throw new Error(`${key}: invalid age series`);
  for (let i = 0; i < expectedLength; i += 1) {
    if (!Number.isInteger(record.t[i]) || record.t[i] <= 0)
      throw new Error(`${key}: invalid total`);
    if (record.a.reduce((sum, series) => sum + series[i], 0) !== record.t[i])
      throw new Error(`${key}: age sum mismatch`);
  }
}
if (index.source.sha256 !== "f04e0ad139667beb9f9fe5113cbf2b06ba7b704bafb4bbfd7f2952b2b7de0164")
  throw new Error("Unexpected source SHA-256");
const find = (place, employment, metric) =>
  records.find((record) => record.p === place && record.e === employment && record.m === metric);
const nationalActive = find("00", "all", "active");
const nationalNew = find("00", "all", "new");
if (nationalActive.t.at(-1) !== 22698922 || nationalNew.t.at(-1) !== 4362423)
  throw new Error("National values changed");
if (nationalActive.a.at(-1).at(-1) !== 3429845 || nationalNew.a.at(-1).at(-1) !== 839847)
  throw new Error("National 65+ values changed");
for (const employment of employmentIds) {
  for (const metric of metricIds) {
    const rows = records.filter((record) => record.e === employment && record.m === metric);
    const national = rows.find((record) => record.p === "00");
    for (let i = 0; i < national.y.length; i += 1) {
      if (
        rows.filter((record) => record.p !== "00").reduce((sum, record) => sum + record.t[i], 0) !==
        national.t[i]
      )
        throw new Error(`${employment} ${metric}: national mismatch`);
    }
  }
}
console.log(
  JSON.stringify({
    ages: index.ageCount,
    asOf: index.asOf,
    checked: index.recordCount,
    places: index.placeCount,
    series: records.length,
  }),
);
