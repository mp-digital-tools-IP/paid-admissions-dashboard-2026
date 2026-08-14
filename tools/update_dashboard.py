#!/usr/bin/env python3
"""Build privacy-safe aggregates for the paid admissions dashboard."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import tempfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from openpyxl import load_workbook


SCHEMA_VERSION = 1
FINANCIAL_TARGET = Decimal("178000000")
REFERENCE_2025 = Decimal("279000000")
EXPECTED_PFHD = 1215
EXPECTED_MARKETING = 5068
FORMS = ("Очная", "Очно-заочная", "Заочная")
MOSCOW_TZ = ZoneInfo("Europe/Moscow")
CODE_RE = re.compile(r"(?<!\d)(\d{1,2}\.\d{1,2}\.\d{1,2})\.?")

REQUIRED_CONTRACT_COLUMNS = {
    "Гражданство физического лица",
    "Конкурсная группа.Уровень подготовки",
    "Факультет",
    "Форма обучения",
    "Код специальности",
    "Конкурсная группа.Направление (специальность)",
    "Приоритет",
    "Состояние заявления",
    "Номер договора",
    "Состояние договора",
    "Размер скидки",
    "Стоимость семестра",
    "Сумма заключенных договоров по 1 семестру",
    "Сумма оплаты",
}

FACULTY_ALIASES = {
    "ФИТ": "Факультет информационных технологий",
    "ФЭУ": "Факультет экономики и управления",
    "ФЭИУ": "Факультет экономики и управления",
    "ФМ": "Факультет машиностроения",
    "ТФ": "Транспортный факультет",
    "ПИШ": 'Передовая инженерная школа технологического лидерства «FDR»',
    "ФУИГХ": "Факультет урбанистики и городского хозяйства",
    "ФИДИЖ": "Институт издательского дела и журналистики",
    "ИИДИЖ": "Институт издательского дела и журналистики",
    "ИГРИК": "Институт графики и искусства книги имени В. А. Фаворского",
    "ФХТИБ": "Факультет химической технологии и биотехнологии",
    "ПФ": "Полиграфический факультет",
    "ПИ": "Полиграфический факультет",
    "ФБК": "Факультет базовых компетенций",
    "ШКОЛА": "Передовая школа инженерного дизайна",
}

PUBLIC_FORBIDDEN_KEYS = {
    "фио",
    "номер договора",
    "contractnumber",
    "телефон",
    "email",
    "почта",
    "паспорт",
    "снилс",
    "инн",
    "адрес",
    "комментарий",
}


class DataValidationError(RuntimeError):
    """Raised before any public artifact is changed."""


@dataclass(frozen=True)
class PlanSheet:
    name: str
    header_row: int
    start_row: int
    faculty_col: int
    code_col: int | None
    name_col: int
    forms: tuple[tuple[str, int, int], ...]
    level: str


PLAN_SHEETS = (
    PlanSheet(
        "Москва",
        11,
        12,
        1,
        7,
        8,
        (("Очная", 29, 30), ("Очно-заочная", 47, 48), ("Заочная", 65, 66)),
        "Бакалавриат и специалитет",
    ),
    PlanSheet(
        "Магистратура",
        8,
        9,
        1,
        2,
        3,
        (("Очная", 15, 16), ("Очно-заочная", 29, 30), ("Заочная", 43, 44)),
        "Магистратура",
    ),
    PlanSheet(
        "Аспирантура",
        3,
        4,
        1,
        None,
        4,
        (("Очная", 15, 16),),
        "Аспирантура",
    ),
)


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_code(value: Any) -> str:
    match = CODE_RE.search(clean_text(value))
    return match.group(1) if match else ""


def number(value: Any, *, field: str, row: int, allow_blank: bool = True) -> Decimal:
    if value is None or clean_text(value) == "":
        if allow_blank:
            return Decimal(0)
        raise DataValidationError(f"Строка {row}: поле «{field}» обязательно")
    if isinstance(value, bool):
        raise DataValidationError(f"Строка {row}: поле «{field}» не является числом")
    try:
        result = Decimal(str(value).replace(" ", "").replace(",", "."))
    except (InvalidOperation, ValueError) as exc:
        raise DataValidationError(f"Строка {row}: некорректное число в поле «{field}»") from exc
    if not result.is_finite():
        raise DataValidationError(f"Строка {row}: некорректное число в поле «{field}»")
    return result


def whole(value: Decimal) -> int:
    return int(value.quantize(Decimal("1")))


def money(value: Decimal) -> int | float:
    rounded = value.quantize(Decimal("0.01"))
    return int(rounded) if rounded == rounded.to_integral() else float(rounded)


def normalize_level(value: Any) -> str:
    text = clean_text(value).casefold()
    if "бакалав" in text or "специал" in text:
        return "Бакалавриат и специалитет"
    if "магистр" in text:
        return "Магистратура"
    if "аспиран" in text:
        return "Аспирантура"
    return clean_text(value)


def normalize_form(value: Any) -> str:
    text = clean_text(value).casefold().replace("ё", "е")
    if "очно-заоч" in text:
        return "Очно-заочная"
    if "заоч" in text:
        return "Заочная"
    if "очн" in text:
        return "Очная"
    return clean_text(value)


def citizenship_group(value: Any) -> str:
    text = clean_text(value).casefold()
    russian_markers = ("россия", "российская федерация", "рф")
    return "Россия" if any(marker == text or marker in text for marker in russian_markers) else "Иностранное"


def faculty_scopes(value: Any) -> list[str]:
    raw = clean_text(value)
    if not raw:
        return ["Не указано"]
    raw = re.sub(r"\([^)]*\)", "", raw)
    raw = raw.replace("/школа", "+школа").replace("/Школа", "+школа")
    parts = [clean_text(part) for part in raw.split("+") if clean_text(part)]
    result: list[str] = []
    for part in parts or [raw]:
        key = re.sub(r"[^А-ЯA-Z]", "", part.upper().replace("Ё", "Е"))
        mapped = FACULTY_ALIASES.get(key, clean_text(part))
        if mapped not in result:
            result.append(mapped)
    return result or ["Не указано"]


def make_id(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:14]


def _header_text(sheet, row: int, col: int) -> str:
    return clean_text(sheet.cell(row, col).value).casefold()


def _validate_plan_sheet(sheet, spec: PlanSheet) -> None:
    for _, pfhd_col, marketing_col in spec.forms:
        pfhd_header = _header_text(sheet, spec.header_row, pfhd_col)
        marketing_header = _header_text(sheet, spec.header_row, marketing_col)
        if "пфхд" not in pfhd_header:
            raise DataValidationError(
                f"Лист «{spec.name}»: не найден заголовок ПФХД в колонке {pfhd_col}"
            )
        if "маркет" not in marketing_header and not (
            "платное" in marketing_header and "пфхд" not in marketing_header
        ):
            raise DataValidationError(
                f"Лист «{spec.name}»: не найден маркетинговый заголовок в колонке {marketing_col}"
            )


def parse_plan(path: Path) -> dict[str, Any]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    missing_sheets = [spec.name for spec in PLAN_SHEETS if spec.name not in workbook.sheetnames]
    if missing_sheets:
        raise DataValidationError(f"В плане отсутствуют листы: {', '.join(missing_sheets)}")

    records: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    for spec in PLAN_SHEETS:
        sheet = workbook[spec.name]
        _validate_plan_sheet(sheet, spec)
        current_faculty = ""
        for row in range(spec.start_row, sheet.max_row + 1):
            if clean_text(sheet.cell(row, spec.faculty_col).value):
                current_faculty = clean_text(sheet.cell(row, spec.faculty_col).value)
            name_cell = clean_text(sheet.cell(row, spec.name_col).value)
            code_cell = sheet.cell(row, spec.code_col).value if spec.code_col else name_cell
            if spec.code_col:
                raw_code = clean_text(code_cell)
                if not re.fullmatch(r"\d{2}\.\d{2}\.\d{2}\.?", raw_code):
                    continue
                code = normalize_code(raw_code)
            else:
                code = normalize_code(code_cell)
            if not code or code.endswith(".00"):
                continue
            name = re.sub(r"^\s*\d{2}\.\d{2}\.\d{2}\.?\s*", "", name_cell).strip() or name_cell
            scopes = faculty_scopes(current_faculty)
            for form, pfhd_col, marketing_col in spec.forms:
                pfhd = whole(number(sheet.cell(row, pfhd_col).value, field="ПФХД", row=row))
                marketing = whole(number(sheet.cell(row, marketing_col).value, field="Маркетинговая цель", row=row))
                signature = (spec.level, form, code, name, tuple(scopes), pfhd, marketing)
                if signature in seen:
                    continue
                seen.add(signature)
                records.append(
                    {
                        "id": make_id(spec.level, form, code, name, "+".join(scopes)),
                        "level": spec.level,
                        "form": form,
                        "code": code,
                        "directionName": name,
                        "facultyScopes": scopes,
                        "joint": len(scopes) > 1,
                        "pfhdTarget": pfhd,
                        "marketingTarget": marketing,
                    }
                )

    totals = {
        "pfhdTarget": sum(row["pfhdTarget"] for row in records),
        "marketingTarget": sum(row["marketingTarget"] for row in records),
    }
    if totals != {"pfhdTarget": EXPECTED_PFHD, "marketingTarget": EXPECTED_MARKETING}:
        raise DataValidationError(
            "Контрольные суммы детального плана не сошлись: "
            f"ПФХД={totals['pfhdTarget']} (ожидалось {EXPECTED_PFHD}), "
            f"маркетинг={totals['marketingTarget']} (ожидалось {EXPECTED_MARKETING})"
        )

    source_pfhd = 0
    source_marketing = 0
    source_formula_errors = 0
    for sheet_name, rows, columns in (
        ("Москва", (12, 14, 18, 37, 39, 41, 48, 62, 64, 66, 71, 76, 82, 87, 95, 103, 107, 109, 115), ((29, 30), (47, 48), (65, 66))),
        ("Магистратура", (90,), ((15, 16), (29, 30), (43, 44))),
        ("Аспирантура", (45,), ((15, 16),)),
    ):
        sheet = workbook[sheet_name]
        for row in rows:
            for pfhd_col, marketing_col in columns:
                for column, field in (
                    (pfhd_col, "Групповой ПФХД"),
                    (marketing_col, "Групповой маркетинг"),
                ):
                    try:
                        value = whole(number(sheet.cell(row, column).value, field=field, row=row))
                    except DataValidationError:
                        source_formula_errors += 1
                        continue
                    if field.endswith("ПФХД"):
                        source_pfhd += value
                    else:
                        source_marketing += value

    workbook.close()
    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": {"file": path.name, "sha256": file_sha256(path)},
        "totals": totals,
        "sourceControlTotals": {
            "pfhdTarget": source_pfhd,
            "marketingTarget": source_marketing,
            "formulaErrors": source_formula_errors,
        },
        "reconciliation": {
            "pfhdDelta": source_pfhd - totals["pfhdTarget"],
            "marketingDelta": source_marketing - totals["marketingTarget"],
            "formulaErrors": source_formula_errors,
            "status": (
                "Групповые итоги содержат ошибки формул; детальные строки являются источником плана"
                if source_formula_errors
                else "Расхождение сохранено как контроль качества"
            ),
        },
        "records": sorted(records, key=lambda row: (row["level"], row["form"], row["code"], row["directionName"], row["id"])),
    }


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _headers(sheet) -> dict[str, int]:
    values = [clean_text(sheet.cell(6, col).value) for col in range(1, 25)]
    if sheet.max_column < 24:
        raise DataValidationError(f"Ожидалось 24 колонки, найдено {sheet.max_column}")
    missing = sorted(REQUIRED_CONTRACT_COLUMNS - set(values))
    if missing:
        raise DataValidationError(f"В выгрузке отсутствуют обязательные колонки: {', '.join(missing)}")
    return {name: index + 1 for index, name in enumerate(values) if name}


def _contract_signature(sheet, row: int, headers: dict[str, int]) -> tuple[Any, ...]:
    safe_fields = (
        "Гражданство физического лица",
        "Конкурсная группа.Уровень подготовки",
        "Факультет",
        "Форма обучения",
        "Код специальности",
        "Конкурсная группа.Направление (специальность)",
        "Приоритет",
        "Состояние заявления",
        "Состояние договора",
        "Размер скидки",
        "Стоимость семестра",
        "Сумма заключенных договоров по 1 семестру",
        "Сумма оплаты",
    )
    return tuple(clean_text(sheet.cell(row, headers[field]).value) for field in safe_fields)


def _empty_metrics() -> dict[str, Any]:
    return {
        "active": 0,
        "signed": 0,
        "paid": 0,
        "discounted": 0,
        "listPriceMin": None,
        "listPriceMax": None,
        "listPriceTotal": Decimal(0),
        "contractAmount": Decimal(0),
        "portfolio": Decimal(0),
        "payment": Decimal(0),
    }


def _add_metric(metrics: dict[str, Any], *, signed: bool, paid: bool, discounted: bool, list_price: Decimal, contract_amount: Decimal, payment: Decimal) -> None:
    metrics["active"] += 1
    metrics["signed"] += int(signed)
    metrics["paid"] += int(paid)
    metrics["discounted"] += int(discounted)
    if list_price > 0:
        metrics["listPriceMin"] = list_price if metrics["listPriceMin"] is None else min(metrics["listPriceMin"], list_price)
        metrics["listPriceMax"] = list_price if metrics["listPriceMax"] is None else max(metrics["listPriceMax"], list_price)
        metrics["listPriceTotal"] += list_price
    metrics["contractAmount"] += contract_amount
    metrics["portfolio"] += contract_amount if signed else Decimal(0)
    metrics["payment"] += payment


def _finalize_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    result = dict(metrics)
    for key in ("listPriceMin", "listPriceMax", "listPriceTotal", "contractAmount", "portfolio", "payment"):
        value = result[key]
        result[key] = None if value is None else money(value)
    return result


def parse_contracts(path: Path, plan: dict[str, Any], snapshot_at: datetime) -> dict[str, Any]:
    workbook = load_workbook(path, read_only=False, data_only=True)
    if "Лист_1" not in workbook.sheetnames:
        raise DataValidationError("В выгрузке отсутствует лист «Лист_1»")
    sheet = workbook["Лист_1"]
    headers = _headers(sheet)
    plan_keys = {(row["level"], row["form"], row["code"]) for row in plan["records"]}
    seen_contracts: dict[str, tuple[Any, ...]] = {}
    segments: dict[tuple[Any, ...], dict[str, Any]] = {}
    totals = _empty_metrics()
    quality = {
        "sourceRows": max(sheet.max_row - 6, 0),
        "priorityOneRows": 0,
        "excludedWithdrawn": 0,
        "excludedCancelled": 0,
        "duplicateContracts": 0,
        "conflictingDuplicates": 0,
        "unmatchedDirections": [],
        "invalidAmounts": 0,
        "discountFormulaMismatches": 0,
        "partialPayments": 0,
        "overpayments": 0,
        "paymentsWithoutSignedStatus": 0,
    }

    for row in range(7, sheet.max_row + 1):
        priority_value = number(sheet.cell(row, headers["Приоритет"]).value, field="Приоритет", row=row)
        if priority_value != 1:
            continue
        quality["priorityOneRows"] += 1
        if clean_text(sheet.cell(row, headers["Состояние заявления"]).value) == "Отозвано":
            quality["excludedWithdrawn"] += 1
            continue
        if clean_text(sheet.cell(row, headers["Состояние договора"]).value) == "Отменен":
            quality["excludedCancelled"] += 1
            continue

        contract_number = clean_text(sheet.cell(row, headers["Номер договора"]).value)
        if not contract_number:
            raise DataValidationError(f"Строка {row}: отсутствует номер договора")
        signature = _contract_signature(sheet, row, headers)
        if contract_number in seen_contracts:
            if seen_contracts[contract_number] != signature:
                quality["conflictingDuplicates"] += 1
                raise DataValidationError(f"Договор {contract_number}: конфликтующие строки-дубли")
            quality["duplicateContracts"] += 1
            continue
        seen_contracts[contract_number] = signature

        level = normalize_level(sheet.cell(row, headers["Конкурсная группа.Уровень подготовки"]).value)
        form = normalize_form(sheet.cell(row, headers["Форма обучения"]).value)
        code = normalize_code(sheet.cell(row, headers["Код специальности"]).value)
        direction_name = clean_text(sheet.cell(row, headers["Конкурсная группа.Направление (специальность)"]).value)
        scopes = faculty_scopes(sheet.cell(row, headers["Факультет"]).value)
        plan_key = (level, form, code)
        if plan_key not in plan_keys:
            quality["unmatchedDirections"].append({"level": level, "form": form, "code": code, "directionName": direction_name})
            continue

        status = clean_text(sheet.cell(row, headers["Состояние договора"]).value)
        signed = status == "Подписан"
        discount_size = number(sheet.cell(row, headers["Размер скидки"]).value, field="Размер скидки", row=row)
        discounted = discount_size > 0
        list_price = number(sheet.cell(row, headers["Стоимость семестра"]).value, field="Стоимость семестра", row=row)
        contract_amount = number(sheet.cell(row, headers["Сумма заключенных договоров по 1 семестру"]).value, field="Сумма заключенных договоров по 1 семестру", row=row)
        payment = number(sheet.cell(row, headers["Сумма оплаты"]).value, field="Сумма оплаты", row=row)
        if min(list_price, contract_amount, payment, discount_size) < 0:
            quality["invalidAmounts"] += 1
        paid = payment > 0
        if paid and not signed:
            quality["paymentsWithoutSignedStatus"] += 1
        if payment > 0 and contract_amount > 0:
            if payment < contract_amount:
                quality["partialPayments"] += 1
            elif payment > contract_amount:
                quality["overpayments"] += 1
        if list_price > 0:
            expected_amount = list_price * (Decimal(1) - discount_size / Decimal(100))
            if abs(expected_amount - contract_amount) > Decimal("1"):
                quality["discountFormulaMismatches"] += 1

        citizenship = citizenship_group(sheet.cell(row, headers["Гражданство физического лица"]).value)
        discount_group = "Есть скидка" if discounted else "Без скидки"
        segment_key = (level, form, code, direction_name, tuple(scopes), citizenship, discount_group)
        if segment_key not in segments:
            segments[segment_key] = _empty_metrics()
        _add_metric(
            segments[segment_key],
            signed=signed,
            paid=paid,
            discounted=discounted,
            list_price=list_price,
            contract_amount=contract_amount,
            payment=payment,
        )
        _add_metric(
            totals,
            signed=signed,
            paid=paid,
            discounted=discounted,
            list_price=list_price,
            contract_amount=contract_amount,
            payment=payment,
        )

    workbook.close()
    if quality["unmatchedDirections"]:
        unique = {(x["level"], x["form"], x["code"], x["directionName"]) for x in quality["unmatchedDirections"]}
        preview = "; ".join(" / ".join(item) for item in sorted(unique)[:8])
        raise DataValidationError(f"Несопоставленные направления ({len(unique)}): {preview}")
    if quality["invalidAmounts"]:
        raise DataValidationError(f"Обнаружены некорректные отрицательные суммы: {quality['invalidAmounts']}")

    public_segments = []
    for key, metrics in segments.items():
        level, form, code, direction_name, scopes, citizenship, discount_group = key
        public_segments.append(
            {
                "id": make_id(level, form, code, direction_name, "+".join(scopes), citizenship, discount_group),
                "level": level,
                "form": form,
                "code": code,
                "directionName": direction_name,
                "facultyScopes": list(scopes),
                "joint": len(scopes) > 1,
                "citizenship": citizenship,
                "discount": discount_group,
                **_finalize_metrics(metrics),
            }
        )

    published_at = datetime.now(MOSCOW_TZ).replace(microsecond=0).isoformat()
    finalized = _finalize_metrics(totals)
    finalized.update(
        {
            "financialTarget": money(FINANCIAL_TARGET),
            "reference2025": money(REFERENCE_2025),
            "remainingToTarget": money(max(FINANCIAL_TARGET - Decimal(str(finalized["payment"])), Decimal(0))),
        }
    )
    return {
        "schemaVersion": SCHEMA_VERSION,
        "snapshotAt": snapshot_at.isoformat(),
        "publishedAt": published_at,
        "source": {"file": path.name, "sha256": file_sha256(path)},
        "metrics": finalized,
        "dimensions": {
            "levels": sorted({row["level"] for row in public_segments}),
            "forms": [form for form in FORMS if any(row["form"] == form for row in public_segments)],
            "faculties": sorted({faculty for row in public_segments for faculty in row["facultyScopes"]}),
            "directions": sorted(
                ({"code": row["code"], "name": row["directionName"]} for row in public_segments),
                key=lambda row: (row["code"], row["name"]),
            ),
            "citizenships": ["Россия", "Иностранное"],
            "discounts": ["Без скидки", "Есть скидка"],
        },
        "segments": sorted(public_segments, key=lambda row: (row["level"], row["form"], row["code"], row["directionName"], row["citizenship"], row["discount"])),
        "quality": {
            **quality,
            "unmatchedDirections": 0,
            "matchedDirectionCodes": len({row["code"] for row in public_segments}),
            "planReconciliation": plan["reconciliation"],
        },
    }


def _plan_fingerprint(plan: dict[str, Any]) -> str:
    body = {"totals": plan["totals"], "records": plan["records"]}
    return hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _public_privacy_check(payloads: Iterable[tuple[str, Any]]) -> None:
    email_re = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-zА-Яа-я]{2,}")
    phone_re = re.compile(r"(?<!\d)(?:\+7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)")

    def walk(value: Any, path: str) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                normalized = re.sub(r"[^a-zа-я0-9]", "", str(key).casefold())
                if normalized in PUBLIC_FORBIDDEN_KEYS:
                    raise DataValidationError(f"Запрещённое поле в публичных данных: {path}.{key}")
                walk(child, f"{path}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}[{index}]")
        elif isinstance(value, str) and (email_re.search(value) or phone_re.search(value)):
            raise DataValidationError(f"Возможные персональные данные в публичном поле: {path}")

    for name, payload in payloads:
        walk(payload, name)


def build_history(existing: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    date = snapshot["snapshotAt"][:10]
    points = [point for point in existing.get("points", []) if point.get("date") != date]
    points.append(
        {
            "date": date,
            "snapshotAt": snapshot["snapshotAt"],
            "publishedAt": snapshot["publishedAt"],
            "metrics": snapshot["metrics"],
        }
    )
    return {"schemaVersion": SCHEMA_VERSION, "points": sorted(points, key=lambda point: point["date"])}


def publish_atomic(public_data: Path, payloads: dict[Path, Any]) -> None:
    public_data.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".dashboard-stage-", dir=public_data.parent))
    backups: dict[Path, bytes | None] = {}
    try:
        for relative, payload in payloads.items():
            destination = stage / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            json.loads(destination.read_text(encoding="utf-8"))
        for relative in payloads:
            target = public_data / relative
            backups[target] = target.read_bytes() if target.exists() else None
        try:
            for relative in payloads:
                target = public_data / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(stage / relative, target)
        except Exception:
            for target, content in backups.items():
                if content is None:
                    target.unlink(missing_ok=True)
                else:
                    target.write_bytes(content)
            raise
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def parse_snapshot_at(value: str) -> datetime:
    try:
        result = datetime.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Используйте ISO-время, например 2026-08-13T22:57:54+03:00") from exc
    if result.tzinfo is None:
        raise argparse.ArgumentTypeError("Время среза должно содержать часовой пояс")
    return result.astimezone(MOSCOW_TZ).replace(microsecond=0)


def update(plan_path: Path, contracts_path: Path, snapshot_at: datetime, output_dir: Path, allow_plan_change: bool = False) -> dict[str, Any]:
    if not plan_path.is_file() or not contracts_path.is_file():
        raise DataValidationError("Файл плана или выгрузки договоров не найден")
    plan = parse_plan(plan_path)
    existing_plan_path = output_dir / "plan.json"
    if existing_plan_path.exists() and not allow_plan_change:
        existing_plan = _read_json(existing_plan_path, {})
        if _plan_fingerprint(existing_plan) != _plan_fingerprint(plan):
            raise DataValidationError("План ПФХД изменился. Повторите с --allow-plan-change только после явного согласования")
        plan = existing_plan
    snapshot = parse_contracts(contracts_path, plan, snapshot_at)
    history = build_history(_read_json(output_dir / "history.json", {}), snapshot)
    payloads = {
        Path("plan.json"): plan,
        Path("current.json"): snapshot,
        Path("history.json"): history,
        Path("snapshots") / f"{snapshot_at.date().isoformat()}.json": snapshot,
    }
    _public_privacy_check((str(path), payload) for path, payload in payloads.items())
    publish_atomic(output_dir, payloads)
    return {"plan": plan["totals"], "metrics": snapshot["metrics"], "quality": snapshot["quality"], "snapshotAt": snapshot["snapshotAt"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--contracts", required=True, type=Path)
    parser.add_argument("--snapshot-at", required=True, type=parse_snapshot_at)
    parser.add_argument("--output", type=Path, default=Path("public/data"))
    parser.add_argument("--allow-plan-change", action="store_true")
    args = parser.parse_args()
    try:
        report = update(args.plan, args.contracts, args.snapshot_at, args.output, args.allow_plan_change)
    except DataValidationError as exc:
        parser.exit(2, f"ОШИБКА ПРОВЕРКИ: {exc}\n")
    metrics = report["metrics"]
    quality = report["quality"]
    print(
        "Срез обновлён:", report["snapshotAt"],
        f"| активные {metrics['active']}",
        f"| подписанные {metrics['signed']}",
        f"| оплаченные {metrics['paid']}",
        f"| оплата {metrics['payment']} руб.",
        f"| портфель {metrics['portfolio']} руб.",
        f"| дубли {quality['duplicateContracts']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
