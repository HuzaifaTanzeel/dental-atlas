"""Case tags derived only from present / missing permanent FDI numbers.

Rules (permanent dentition = FDI 11–18, 21–28, 31–38, 41–48):

- complete-dentition: all 32 permanent teeth present
- single-missing: exactly one permanent tooth missing
- multiple-missing: two or more permanent teeth missing
- anterior-missing: at least one missing tooth with FDI digit 1–3 (incisor or canine)
- posterior-missing: at least one missing tooth with FDI digit 4–8 (premolar or molar)
- third-molars-absent: all four third molars (18, 28, 38, 48) are missing
- bilateral-pattern: for at least one arch and tooth digit, both left and right
  counterparts are missing (e.g. 16 and 26, or 33 and 43)

Tags are independent except complete-dentition vs single/multiple-missing
(those three are mutually exclusive). Anterior and posterior can both apply.
"""

from __future__ import annotations

from typing import Iterable

PERMANENT_FDI: tuple[int, ...] = tuple(
    quadrant * 10 + digit
    for quadrant in (1, 2, 3, 4)
    for digit in range(1, 9)
)

THIRD_MOLARS: frozenset[int] = frozenset({18, 28, 38, 48})

# Same arch, left/right pairs: (right_fdi, left_fdi) for digits 1–8
_BILATERAL_PAIRS: tuple[tuple[int, int], ...] = tuple(
    (arch_right * 10 + digit, arch_left * 10 + digit)
    for arch_right, arch_left in ((1, 2), (4, 3))
    for digit in range(1, 9)
)


def normalize_present(present: Iterable[int]) -> frozenset[int]:
    return frozenset(int(value) for value in present if int(value) in PERMANENT_FDI)


def missing_from(present: Iterable[int]) -> list[int]:
    have = normalize_present(present)
    return sorted(fdi for fdi in PERMANENT_FDI if fdi not in have)


def fdi_digit(fdi: int) -> int:
    return int(fdi) % 10


def case_tags(present: Iterable[int]) -> list[str]:
    have = normalize_present(present)
    missing = [fdi for fdi in PERMANENT_FDI if fdi not in have]
    tags: list[str] = []

    if not missing:
        tags.append("complete-dentition")
    elif len(missing) == 1:
        tags.append("single-missing")
    else:
        tags.append("multiple-missing")

    if any(fdi_digit(fdi) <= 3 for fdi in missing):
        tags.append("anterior-missing")
    if any(fdi_digit(fdi) >= 4 for fdi in missing):
        tags.append("posterior-missing")

    if THIRD_MOLARS.isdisjoint(have):
        tags.append("third-molars-absent")

    missing_set = set(missing)
    if any(right in missing_set and left in missing_set for right, left in _BILATERAL_PAIRS):
        tags.append("bilateral-pattern")

    return tags


def has_third_molars(present: Iterable[int]) -> bool:
    have = normalize_present(present)
    return not THIRD_MOLARS.isdisjoint(have)


def tooth_count_by_arch(present: Iterable[int]) -> dict[str, int]:
    have = normalize_present(present)
    upper = sum(1 for fdi in have if fdi // 10 in (1, 2))
    lower = sum(1 for fdi in have if fdi // 10 in (3, 4))
    return {"upper": upper, "lower": lower}


def summary_line(present: Iterable[int]) -> str:
    missing = missing_from(present)
    if not missing:
        return "Complete permanent dentition"
    return "Missing: " + ", ".join(str(fdi) for fdi in missing)


def descriptive_label(case_number: int, present: Iterable[int]) -> str:
    """Human label kept for older UI paths that only read `label`."""
    missing = missing_from(present)
    tags = case_tags(present)
    if "complete-dentition" in tags:
        detail = "complete dentition"
    elif "third-molars-absent" in tags and set(missing) == set(THIRD_MOLARS):
        detail = "third molars absent"
    elif len(missing) == 1:
        detail = f"FDI {missing[0]} absent"
    elif len(missing) == 2 and "bilateral-pattern" in tags:
        detail = f"both {missing[0]} and {missing[1]} absent"
    elif len(missing) <= 3:
        detail = f"FDI {', '.join(str(fdi) for fdi in missing)} absent"
    else:
        detail = "several missing teeth"
    return f"Patient {case_number} — {detail}"
