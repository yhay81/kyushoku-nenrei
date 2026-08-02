"""Extract sex-total age bands from MHLW annual jobseeker table 3."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import openpyxl

SOURCE_URL = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-03.xlsx"
EMPLOYMENTS = [
    ("all", list(range(2011, 2026))),
    ("full", list(range(2020, 2026))),
    ("part", list(range(2020, 2026))),
]
METRICS = [("new", 0, "新規求職申込件数"), ("active", 1, "月間有効求職者数")]
AGES = [
    ("u19", "19歳以下", "〜19"),
    ("20-24", "20～24歳", "20"),
    ("25-29", "25～29歳", "25"),
    ("30-34", "30～34歳", "30"),
    ("35-39", "35～39歳", "35"),
    ("40-44", "40～44歳", "40"),
    ("45-49", "45～49歳", "45"),
    ("50-54", "50～54歳", "50"),
    ("55-59", "55～59歳", "55"),
    ("60-64", "60～64歳", "60"),
    ("65p", "65歳以上", "65+"),
]
PREFECTURES = [
    ("01", "北海道", "北海道"), ("02", "青森", "東北"), ("03", "岩手", "東北"),
    ("04", "宮城", "東北"), ("05", "秋田", "東北"), ("06", "山形", "東北"),
    ("07", "福島", "東北"), ("08", "茨城", "関東"), ("09", "栃木", "関東"),
    ("10", "群馬", "関東"), ("11", "埼玉", "関東"), ("12", "千葉", "関東"),
    ("13", "東京", "関東"), ("14", "神奈川", "関東"), ("15", "新潟", "北陸甲信越"),
    ("16", "富山", "北陸甲信越"), ("17", "石川", "北陸甲信越"), ("18", "福井", "北陸甲信越"),
    ("19", "山梨", "北陸甲信越"), ("20", "長野", "北陸甲信越"), ("21", "岐阜", "東海"),
    ("22", "静岡", "東海"), ("23", "愛知", "東海"), ("24", "三重", "東海"),
    ("25", "滋賀", "近畿"), ("26", "京都", "近畿"), ("27", "大阪", "近畿"),
    ("28", "兵庫", "近畿"), ("29", "奈良", "近畿"), ("30", "和歌山", "近畿"),
    ("31", "鳥取", "中国"), ("32", "島根", "中国"), ("33", "岡山", "中国"),
    ("34", "広島", "中国"), ("35", "山口", "中国"), ("36", "徳島", "四国"),
    ("37", "香川", "四国"), ("38", "愛媛", "四国"), ("39", "高知", "四国"),
    ("40", "福岡", "九州・沖縄"), ("41", "佐賀", "九州・沖縄"), ("42", "長崎", "九州・沖縄"),
    ("43", "熊本", "九州・沖縄"), ("44", "大分", "九州・沖縄"), ("45", "宮崎", "九州・沖縄"),
    ("46", "鹿児島", "九州・沖縄"), ("47", "沖縄", "九州・沖縄"),
]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract-source.py SOURCE.xlsx OUTPUT_DIRECTORY")
    source_path = Path(sys.argv[1])
    output_directory = Path(sys.argv[2])
    workbook = openpyxl.load_workbook(source_path, read_only=False, data_only=True)
    if len(workbook.worksheets) != 3:
        raise ValueError("expected exactly three employment sheets")
    places = [{"id": "00", "name": "全国", "region": "全国"}] + [
        {"id": item_id, "name": name, "region": region} for item_id, name, region in PREFECTURES
    ]
    source_labels = ["全国計"] + [f"{name}労働局" for _item_id, name, _region in PREFECTURES]
    records: list[dict[str, object]] = []
    by_key: dict[tuple[str, str, str], dict[str, object]] = {}

    for sheet_index, (employment_id, expected_years) in enumerate(EMPLOYMENTS):
        sheet = workbook.worksheets[sheet_index]
        column_pairs = [(column, column + 1) for column in range(4, sheet.max_column + 1) if sheet.cell(1, column).value is not None]
        years = [int(str(sheet.cell(1, column).value).replace("年度", "")) for column, _ in column_pairs]
        if years != expected_years:
            raise ValueError(f"unexpected years for {employment_id}: {years}")
        for place_index, (place, source_label) in enumerate(zip(places, source_labels, strict=True)):
            base = 3 + place_index * 36
            if sheet.cell(base, 1).value != source_label or sheet.cell(base, 2).value != "性計" or sheet.cell(base, 3).value != "年齢計":
                raise ValueError(f"unexpected place header: {employment_id} {source_label}")
            labels = [sheet.cell(base + offset, 3).value for offset in range(1, 12)]
            if labels != [label for _item_id, label, _short in AGES]:
                raise ValueError(f"unexpected age bands: {employment_id} {source_label}")
            for metric_id, column_offset, _metric_name in METRICS:
                total = [int(sheet.cell(base, pair[column_offset]).value) for pair in column_pairs]
                age_series = [
                    [int(sheet.cell(base + age_offset, pair[column_offset]).value) for pair in column_pairs]
                    for age_offset in range(1, 12)
                ]
                if any(value <= 0 for value in total) or any(value <= 0 for series in age_series for value in series):
                    raise ValueError(f"non-positive value: {employment_id} {source_label} {metric_id}")
                for year_index in range(len(years)):
                    if sum(series[year_index] for series in age_series) != total[year_index]:
                        raise ValueError(f"age sum mismatch: {employment_id} {source_label} {metric_id} {years[year_index]}")
                record = {"p": place["id"], "e": employment_id, "m": metric_id, "y": years, "t": total, "a": age_series}
                records.append(record)
                by_key[(place["id"], employment_id, metric_id)] = record

    for employment_id, years in EMPLOYMENTS:
        for metric_id, _column_offset, _metric_name in METRICS:
            national = by_key[("00", employment_id, metric_id)]
            rows = [by_key[(place["id"], employment_id, metric_id)] for place in places[1:]]
            for year_index, year in enumerate(years):
                if sum(row["t"][year_index] for row in rows) != national["t"][year_index]:
                    raise ValueError(f"national total mismatch: {employment_id} {metric_id} {year}")
                for age_index in range(len(AGES)):
                    if sum(row["a"][age_index][year_index] for row in rows) != national["a"][age_index][year_index]:
                        raise ValueError(f"national age mismatch: {employment_id} {metric_id} {year} {age_index}")
    for place in places:
        for metric_id, _column_offset, _metric_name in METRICS:
            all_record = by_key[(place["id"], "all", metric_id)]
            full_record = by_key[(place["id"], "full", metric_id)]
            part_record = by_key[(place["id"], "part", metric_id)]
            for year in range(2020, 2026):
                all_index = all_record["y"].index(year)
                part_index = part_record["y"].index(year)
                if all_record["t"][all_index] != full_record["t"][part_index] + part_record["t"][part_index]:
                    raise ValueError(f"employment total mismatch: {place['id']} {metric_id} {year}")
                for age_index in range(len(AGES)):
                    if all_record["a"][age_index][all_index] != full_record["a"][age_index][part_index] + part_record["a"][age_index][part_index]:
                        raise ValueError(f"employment age mismatch: {place['id']} {metric_id} {year} {age_index}")

    record_count = sum(len(record["y"]) * (len(AGES) + 1) for record in records)
    if len(records) != 288 or record_count != 31_104:
        raise ValueError(f"unexpected output size: {len(records)=} {record_count=}")
    index = {
        "schemaVersion": 1,
        "asOf": "2026-08-02",
        "edition": "2025年度（令和7年度）まで",
        "placeCount": 48,
        "prefectureCount": 47,
        "employmentCount": 3,
        "metricCount": 2,
        "ageCount": 11,
        "seriesCount": len(records),
        "recordCount": record_count,
        "places": places,
        "employments": [{"id": item_id, "years": years} for item_id, years in EMPLOYMENTS],
        "metrics": [{"id": item_id, "name": name} for item_id, _column_offset, name in METRICS],
        "ages": [{"id": item_id, "name": name, "short": short} for item_id, name, short in AGES],
        "source": {"url": SOURCE_URL, "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest()},
    }
    output_directory.mkdir(parents=True, exist_ok=True)
    (output_directory / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (output_directory / "jobseekers.json").write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"ages": len(AGES), "checked": record_count, "places": len(places), "series": len(records), "sha256": index["source"]["sha256"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
