const MAX_COMPARE = 4;
const STORAGE_KEY = "kyushoku-nenrei:compare:v1";
const DEFAULT_SELECTED = ["00", "13", "27"];

const search = document.querySelector("#search");
const region = document.querySelector("#region");
const sort = document.querySelector("#sort");
const employment = document.querySelector("#employment");
const metric = document.querySelector("#metric");
const year = document.querySelector("#year");
const ageFocus = document.querySelector("#age-focus");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const metricNote = document.querySelector("#metric-note");
const compareList = document.querySelector("#compare-list");
const compareCount = document.querySelector("#compare-count");
const copyCompare = document.querySelector("#copy-compare");

let index = null;
let records = [];
let recordMap = new Map();
let selected = loadSelected();
let searchTimer;
let noResultReported = false;

const isPrivacyEnabled = () =>
  navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const isQa = () => navigator.webdriver === true || new URLSearchParams(location.search).has("qa");
const getSession = () => {
  const key = "kyushoku-nenrei:session:v1";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const track = (name) => {
  if (isPrivacyEnabled()) return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kyushoku-nenrei-session": getSession(),
      "x-kyushoku-nenrei-qa": isQa() ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

function loadSelected() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return [...DEFAULT_SELECTED];
    const value = JSON.parse(stored);
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [...DEFAULT_SELECTED];
  } catch {
    return [...DEFAULT_SELECTED];
  }
}
function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    /* Current view still works. */
  }
}

const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/\s/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = new Intl.NumberFormat("ja-JP");
const selectedRecord = (placeId) => recordMap.get(`${placeId}|${employment.value}|${metric.value}`);
const selectedAgeIndex = () => index.ages.findIndex((item) => item.id === ageFocus.value);
const selectedAge = () => index.ages[selectedAgeIndex()];
const employmentLabel = () =>
  ({ all: "パートを含む常用", full: "パートを除く常用", part: "常用的パート" })[employment.value];
const metricLabel = () => index.metrics.find((item) => item.id === metric.value).name;
const currentYear = () => Number(year.value);
const yearIndexFor = (record) => record?.y.indexOf(currentYear()) ?? -1;
const valuesFor = (placeId, requestedYear = currentYear()) => {
  const record = selectedRecord(placeId);
  const yearIndex = record?.y.indexOf(requestedYear) ?? -1;
  if (!record || yearIndex < 0) return null;
  const total = record.t[yearIndex];
  const ages = record.a.map((series) => series[yearIndex]);
  const shares = ages.map((value) => (value / total) * 100);
  const focusIndex = selectedAgeIndex();
  const largestIndex = ages.reduce((best, value, i) => (value > ages[best] ? i : best), 0);
  return {
    ages,
    focusCount: ages[focusIndex],
    focusShare: shares[focusIndex],
    largestIndex,
    shares,
    total,
  };
};
const focusChange = (placeId) => {
  const record = selectedRecord(placeId);
  const currentIndex = yearIndexFor(record);
  if (currentIndex <= 0) return null;
  const current = valuesFor(placeId, record.y[currentIndex]);
  const previous = valuesFor(placeId, record.y[currentIndex - 1]);
  return current.focusShare - previous.focusShare;
};
const formatShare = (value) => (value === null ? "—" : `${value.toFixed(1)}%`);
const formatPoint = (value) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`;
const formatCount = (value) => (value === null ? "—" : number.format(value));

const notes = {
  active:
    "月間有効求職者数の年度値は月ごとの延べ人数です。同じ人が複数月に含まれることがあります。",
  new: "新規求職申込件数は年度中に受け付けた申込み件数です。固有の人数とは一致しない場合があります。",
};

function updateYearOptions(preferredYear = null) {
  const employmentDefinition = index.employments.find((item) => item.id === employment.value);
  const years = employmentDefinition.years;
  const target =
    preferredYear !== null && years.includes(preferredYear) ? preferredYear : years.at(-1);
  year.innerHTML = [...years]
    .reverse()
    .map(
      (value) =>
        `<option value="${value}"${value === target ? " selected" : ""}>${value}年度</option>`,
    )
    .join("");
}

function distributionBar(values, label) {
  let cursor = 0;
  const segments = values.shares.map((share, i) => {
    const output = `<rect class="age-color-${i}" height="12" width="${share.toFixed(4)}" x="${cursor.toFixed(4)}" y="0"><title>${escapeHtml(index.ages[i].name)} ${share.toFixed(1)}%</title></rect>`;
    cursor += share;
    return output;
  });
  return `<svg aria-label="${escapeHtml(label)}" class="distribution-bar" preserveAspectRatio="none" role="img" viewBox="0 0 100 12">${segments.join("")}</svg>`;
}

function ageRows(values) {
  return `<div class="age-rows">${index.ages.map((age, i) => `<div class="age-row"><span>${escapeHtml(age.short)}</span><svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 8"><rect class="age-track" height="8" width="100"></rect><rect class="age-color-${i}" height="8" width="${values.shares[i].toFixed(3)}"></rect></svg><b>${values.shares[i].toFixed(1)}%</b></div>`).join("")}</div>`;
}

function focusRange() {
  const ageIndex = selectedAgeIndex();
  const values = records
    .filter((record) => record.e === employment.value && record.m === metric.value)
    .flatMap((record) => record.t.map((total, i) => (record.a[ageIndex][i] / total) * 100));
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);
  return { min, max: Math.max(min + 1, max) };
}

function sparkline(placeId) {
  const record = selectedRecord(placeId);
  const ageIndex = selectedAgeIndex();
  const shares = record.t.map((total, i) => (record.a[ageIndex][i] / total) * 100);
  const range = focusRange();
  const points = shares
    .map((value, i) => {
      const x = shares.length === 1 ? 50 : (i / (shares.length - 1)) * 100;
      const y = 47 - ((value - range.min) / (range.max - range.min)) * 42;
      return `${x.toFixed(2)},${Math.max(5, Math.min(47, y)).toFixed(2)}`;
    })
    .join(" ");
  const markerIndex = yearIndexFor(record);
  const markerX = (markerIndex / (shares.length - 1)) * 100;
  const markerY = 47 - ((shares[markerIndex] - range.min) / (range.max - range.min)) * 42;
  return `<svg aria-label="${escapeHtml(selectedAge().name)}の構成比推移" class="sparkline" role="img" viewBox="0 0 100 52"><line class="spark-grid" x1="0" x2="100" y1="47" y2="47"></line><polyline class="spark-path" points="${points}"></polyline><circle class="spark-marker" cx="${markerX.toFixed(2)}" cy="${Math.max(5, Math.min(47, markerY)).toFixed(2)}" r="2.7"></circle></svg>`;
}

function renderCompare() {
  const places = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean);
  compareCount.textContent = `${places.length} / ${MAX_COMPARE}`;
  copyCompare.disabled = places.length === 0;
  if (places.length === 0) {
    compareList.className = "empty-compare";
    compareList.textContent = "一覧の「比較に追加」から、2〜4地域を選んでください。";
    return;
  }
  compareList.className = "compare-list";
  compareList.innerHTML = places
    .map((place) => {
      const values = valuesFor(place.id);
      const record = selectedRecord(place.id);
      return `<article class="compare-card"><div class="compare-title"><div><span>${escapeHtml(place.region)}</span><strong>${escapeHtml(place.name)}</strong></div><button aria-label="${escapeHtml(place.name)}を比較から外す" data-remove="${place.id}" type="button">×</button></div>${ageRows(values)}<div class="trend-box"><div><span>${escapeHtml(selectedAge().name)}</span><b>${formatShare(values.focusShare)}</b></div>${sparkline(place.id)}<small>${record.y[0]}—${record.y.at(-1)}</small></div><dl class="count-pair"><div><dt>注目年代</dt><dd>${formatCount(values.focusCount)}</dd></div><div><dt>年代計</dt><dd>${formatCount(values.total)}</dd></div><div><dt>前年差</dt><dd>${formatPoint(focusChange(place.id))}</dd></div></dl></article>`;
    })
    .join("");
}

function visiblePlaces() {
  const term = normalize(search.value);
  const selectedRegion = region.value;
  const filtered = index.places.filter((place) => {
    const haystack = normalize(`${place.name}${place.region}`);
    return (
      (!term || haystack.includes(term)) &&
      (selectedRegion === "all" || place.region === selectedRegion)
    );
  });
  const sorted = [...filtered];
  const numericSort = (getter) => (a, b) => getter(b.id) - getter(a.id) || a.id.localeCompare(b.id);
  if (sort.value === "focus-desc") sorted.sort(numericSort((id) => valuesFor(id).focusShare));
  if (sort.value === "count-desc") sorted.sort(numericSort((id) => valuesFor(id).focusCount));
  if (sort.value === "change-desc") sorted.sort(numericSort((id) => focusChange(id) ?? -Infinity));
  if (sort.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return sorted;
}

function renderResults() {
  const visible = visiblePlaces();
  resultCount.textContent = number.format(visible.length);
  if (visible.length === 0) {
    results.innerHTML =
      '<div class="no-results"><span>0</span><h3>一致する地域がありません</h3><p>都道府県名を短くするか、地域を「すべて」に戻してください。</p></div>';
    if (!noResultReported) {
      noResultReported = true;
      track("no_result");
    }
    return;
  }
  noResultReported = false;
  results.innerHTML = visible
    .map((place) => {
      const values = valuesFor(place.id);
      const active = selected.includes(place.id);
      const disabled = !active && selected.length >= MAX_COMPARE;
      return `<article class="place-card"><div class="place-heading"><div><p>${escapeHtml(place.region)} · ${escapeHtml(place.id)}</p><h3>${escapeHtml(place.name)}</h3></div><strong>${formatShare(values.focusShare)}</strong></div><div class="focus-label"><span>${escapeHtml(selectedAge().name)}</span><b>${formatCount(values.focusCount)}</b></div>${distributionBar(values, `${place.name}の11年代構成`)}<dl class="place-counts"><div><dt>最も多い年代</dt><dd>${escapeHtml(index.ages[values.largestIndex].name)} · ${values.shares[values.largestIndex].toFixed(1)}%</dd></div><div><dt>年代計</dt><dd>${formatCount(values.total)}</dd></div><div><dt>構成比の前年差</dt><dd>${formatPoint(focusChange(place.id))}</dd></div></dl><button class="compare-button${active ? " is-selected" : ""}" data-select="${place.id}" ${disabled ? "disabled" : ""} type="button">${active ? "比較中" : disabled ? "4地域を選択済み" : "比較に追加"}</button></article>`;
    })
    .join("");
}

function renderAll() {
  metricNote.textContent = notes[metric.value];
  renderCompare();
  renderResults();
}
function toggleSelected(id) {
  if (selected.includes(id)) selected = selected.filter((item) => item !== id);
  else if (selected.length < MAX_COMPARE) {
    selected = [...selected, id];
    track("compared");
  }
  saveSelected();
  renderAll();
}

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) toggleSelected(button.dataset.select);
});
compareList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toggleSelected(button.dataset.remove);
});
search.addEventListener("input", () => {
  renderResults();
  clearTimeout(searchTimer);
  if (search.value.trim()) searchTimer = setTimeout(() => track("searched"), 650);
});
region.addEventListener("change", () => {
  renderResults();
  track("region_changed");
});
sort.addEventListener("change", () => {
  renderResults();
  track("sort_changed");
});
employment.addEventListener("change", () => {
  updateYearOptions(currentYear());
  renderAll();
  track("employment_changed");
});
metric.addEventListener("change", () => {
  renderAll();
  track("metric_changed");
});
year.addEventListener("change", () => {
  renderAll();
  track("year_changed");
});
ageFocus.addEventListener("change", () => {
  renderAll();
  track("age_changed");
});
copyCompare.addEventListener("click", async () => {
  const lines = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean)
    .map((place) => {
      const values = valuesFor(place.id);
      return `${place.name}｜${selectedAge().name} ${formatCount(values.focusCount)}・${formatShare(values.focusShare)}｜年代計 ${formatCount(values.total)}｜前年差 ${formatPoint(focusChange(place.id))}`;
    });
  await navigator.clipboard.writeText(
    [
      `${selectedAge().name}の求職者構成（${currentYear()}年度・${employmentLabel()}・${metricLabel()}）`,
      ...lines,
      "集計件数と構成比。個人の年齢、能力、就職しやすさ、地域の優劣を示しません。",
      "出典：厚生労働省「職業安定業務統計 雇用関係指標 第3表」",
    ].join("\n"),
  );
  copyCompare.textContent = "コピーしました";
  setTimeout(() => {
    copyCompare.textContent = "比較をコピー";
  }, 1600);
  track("copied");
});

Promise.all([
  fetch("/data/index.json").then((response) => {
    if (!response.ok) throw new Error("index_unavailable");
    return response.json();
  }),
  fetch("/data/jobseekers.json").then((response) => {
    if (!response.ok) throw new Error("data_unavailable");
    return response.json();
  }),
])
  .then(([indexData, jobseekerData]) => {
    index = indexData;
    records = jobseekerData;
    recordMap = new Map(records.map((record) => [`${record.p}|${record.e}|${record.m}`, record]));
    const validIds = new Set(index.places.map((place) => place.id));
    selected = selected.filter((id) => validIds.has(id));
    saveSelected();
    ageFocus.innerHTML = index.ages
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}"${item.id === "65p" ? " selected" : ""}>${escapeHtml(item.name)}</option>`,
      )
      .join("");
    updateYearOptions();
    const regions = [...new Set(index.places.map((place) => place.region))];
    region.insertAdjacentHTML(
      "beforeend",
      regions
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join(""),
    );
    dataStatus.textContent = "全国・47労働局 · 11年代 · 2011—2025年度";
    renderAll();
    track("visited");
  })
  .catch(() => {
    dataStatus.textContent = "データを読み込めませんでした。再読み込みしてください。";
    results.innerHTML =
      '<div class="no-results"><h3>公式表を表示できません</h3><p>通信状態を確認して、ページを再読み込みしてください。</p></div>';
  });
