import json
import sys
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from build_tuition_reference import build_reference  # noqa: E402

from update_dashboard import (  # noqa: E402
    build_history, citizenship_group, faculty_scopes, normalize_code, normalize_form,
    normalize_level, parse_contracts, parse_plan, parse_snapshot_at,
)


class ProcessorUnitTests(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(normalize_code("5.10.3."), "5.10.3")
        self.assertEqual(normalize_code("09.03.01"), "09.03.01")
        self.assertEqual(normalize_level("Специалитет"), "Бакалавриат и специалитет")
        self.assertEqual(normalize_form("Очно-заочная форма"), "Очно-заочная")
        self.assertEqual(normalize_form("очно- заочная"), "Очно-заочная")
        self.assertEqual(citizenship_group("РОССИЯ"), "Россия")
        self.assertEqual(citizenship_group("РЕСПУБЛИКА БЕЛАРУСЬ"), "Иностранное")

    def test_joint_faculty_mapping(self):
        self.assertEqual(faculty_scopes("ФИТ(50/10)+ФЭУ(60/10)"), ["Факультет информационных технологий", "Факультет экономики и управления"])

    def test_history_replaces_same_date(self):
        first = {"snapshotAt": "2026-08-13T10:00:00+03:00", "publishedAt": "2026-08-13T10:01:00+03:00", "metrics": {"reportedPayment": 10}}
        second = {"snapshotAt": "2026-08-13T18:00:00+03:00", "publishedAt": "2026-08-13T18:01:00+03:00", "metrics": {"reportedPayment": 20}}
        history = build_history(build_history({}, first), second)
        self.assertEqual(len(history["points"]), 1)
        self.assertEqual(history["points"][0]["metrics"]["reportedPayment"], 20)

    def test_snapshot_requires_timezone(self):
        with self.assertRaises(Exception):
            parse_snapshot_at("2026-08-13T22:57:54")


@unittest.skipUnless((ROOT / "ПФХД2 (13.08.2026).xlsx").exists(), "Локальные Excel отсутствуют")
class BaselineIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = parse_plan(ROOT / "ПФХД2 (13.08.2026).xlsx")
        cls.snapshot = parse_contracts(ROOT / "Выгрузка договор от 13.08.2026.xlsx", cls.plan, datetime.fromisoformat("2026-08-13T22:57:54+03:00"))
        cls.tuition = build_reference(ROOT / "Стоимость обучения.pdf", ROOT / "ПФХД2 (13.08.2026).xlsx", ROOT / "Выгрузка договор от 13.08.2026.xlsx")

    def test_tuition_reference_uses_order_then_pfhd(self):
        self.assertEqual(self.tuition["coverage"]["orderEntries"], 124)
        self.assertEqual(self.tuition["coverage"]["fromOrder"], 124)
        self.assertEqual(self.tuition["coverage"]["fromPfhd"], 2)
        self.assertEqual(self.tuition["coverage"]["records"], 126)
        self.assertEqual(self.tuition["coverage"]["missingActivePlanRows"], 7)
        self.assertTrue(all(item["annualCost"] > 0 for item in self.tuition["records"]))
        self.assertTrue(all(item["form"] in ("Очная", "Очно-заочная", "Заочная") for item in self.tuition["records"]))
    def test_plan_control_totals(self):
        self.assertEqual(self.plan["totals"], {"pfhdTarget": 1215, "marketingTarget": 5068})

    def test_full_contract_totals(self):
        metrics = self.snapshot["metrics"]
        self.assertEqual(metrics["reportedPayment"], 143023403)
        self.assertEqual(metrics["uniqueContractPayment"], 142718003)
        self.assertEqual(metrics["contracts"], 3608)
        self.assertEqual(metrics["uniquePeople"], 1856)
        self.assertEqual(metrics["portfolio"], 398547860)

    def test_operational_priority_one_reconciliation(self):
        metrics = self.snapshot["quality"]["reconciliation"]["operationalPriorityOne"]
        self.assertEqual(metrics["contracts"], 1578)
        self.assertEqual(metrics["signed"], 1183)
        self.assertEqual(metrics["paid"], 698)
        self.assertEqual(metrics["uniqueContractPayment"], 113288873)
        self.assertEqual(metrics["portfolio"], 193673205)

    def test_priority_one_and_two_are_published(self):
        rows = {row["value"]: row for row in self.snapshot["breakdowns"]["priorities"]}
        self.assertEqual(rows["1"]["reportedPayment"], 116647748)
        self.assertEqual(rows["2"]["reportedPayment"], 8836775)

    def test_quality_and_source_reconciliation(self):
        quality = self.snapshot["quality"]
        self.assertEqual(quality["sourceSummaryDelta"], 0)
        self.assertEqual(quality["duplicateContracts"], 5)
        self.assertEqual(quality["duplicatePayment"], 305400)

    def test_public_snapshot_has_no_private_fields(self):
        text = json.dumps(self.snapshot, ensure_ascii=False).casefold()
        for forbidden in ("фио", "номер договора", "телефон", "email", "почта"):
            self.assertNotIn(forbidden, text)


if __name__ == "__main__":
    unittest.main()
