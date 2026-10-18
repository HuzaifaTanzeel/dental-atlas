"""Unit tests for scripts/case-tags.py (stdlib unittest)."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("case_tags", REPO / "scripts" / "case-tags.py")
case_tags = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(case_tags)


ALL = list(case_tags.PERMANENT_FDI)


class CaseTagsTests(unittest.TestCase):
    def test_complete_dentition(self) -> None:
        tags = case_tags.case_tags(ALL)
        self.assertEqual(tags, ["complete-dentition"])
        self.assertEqual(case_tags.summary_line(ALL), "Complete permanent dentition")

    def test_single_missing_anterior(self) -> None:
        present = [fdi for fdi in ALL if fdi != 23]
        tags = case_tags.case_tags(present)
        self.assertIn("single-missing", tags)
        self.assertIn("anterior-missing", tags)
        self.assertNotIn("multiple-missing", tags)
        self.assertNotIn("complete-dentition", tags)
        self.assertEqual(case_tags.missing_from(present), [23])

    def test_multiple_posterior_and_third_molars(self) -> None:
        present = [fdi for fdi in ALL if fdi not in (18, 28, 38, 48, 36)]
        tags = case_tags.case_tags(present)
        self.assertIn("multiple-missing", tags)
        self.assertIn("posterior-missing", tags)
        self.assertIn("third-molars-absent", tags)
        self.assertTrue(case_tags.has_third_molars([18]))
        self.assertFalse(case_tags.has_third_molars(present))

    def test_bilateral_pattern(self) -> None:
        present = [fdi for fdi in ALL if fdi not in (13, 23)]
        tags = case_tags.case_tags(present)
        self.assertIn("bilateral-pattern", tags)
        self.assertIn("anterior-missing", tags)

    def test_tooth_counts(self) -> None:
        present = [11, 21, 36]
        counts = case_tags.tooth_count_by_arch(present)
        self.assertEqual(counts, {"upper": 2, "lower": 1})


if __name__ == "__main__":
    unittest.main()
