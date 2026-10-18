"""Scan raw-data/selected, assign stable patient-NN ids, convert, write manifests.

Stable ids: directories sorted by sha256(sourceId), then numbered patient-01…
Cohort (scripts/cohort.json) keeps sourceId. Public manifest does not.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
import trimesh

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_ROOT = REPO_ROOT / "raw-data" / "selected"
DEFAULT_COHORT = REPO_ROOT / "scripts" / "cohort.json"
DEFAULT_MANIFEST = REPO_ROOT / "src" / "data" / "patients.json"
DEFAULT_OUT_DIR = REPO_ROOT / "public" / "data"


def _load_script(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


convert_patient = _load_script("convert_patient", REPO_ROOT / "scripts" / "convert-patient.py")
case_tags = _load_script("case_tags", REPO_ROOT / "scripts" / "case-tags.py")


def source_id_hash(source_id: str) -> str:
    return hashlib.sha256(source_id.encode("utf-8")).hexdigest()


def patient_arches(path: Path) -> list[str]:
    """Return labeled jaws present for a patient directory (upper/lower/both)."""
    source_id = path.name
    arches: list[str] = []
    for jaw in ("upper", "lower"):
        obj = path / f"{source_id}_{jaw}.obj"
        label = path / f"{source_id}_{jaw}.json"
        if obj.is_file() and label.is_file():
            arches.append(jaw)
    return arches


def is_complete_patient_dir(path: Path) -> bool:
    """True when at least one labeled jaw is present (partial arches allowed)."""
    return path.is_dir() and len(patient_arches(path)) > 0


def discover_source_ids(source_root: Path) -> list[str]:
    if not source_root.is_dir():
        raise FileNotFoundError(f"source root missing: {source_root}")
    found = [path.name for path in source_root.iterdir() if is_complete_patient_dir(path)]
    found.sort(key=lambda source_id: (source_id_hash(source_id), source_id))
    return found


def load_previous_labels(cohort_path: Path) -> dict[str, str]:
    if not cohort_path.is_file():
        return {}
    try:
        data = json.loads(cohort_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, list):
        return {}
    labels: dict[str, str] = {}
    for entry in data:
        if not isinstance(entry, dict):
            continue
        source_id = entry.get("sourceId")
        label = entry.get("label")
        if isinstance(source_id, str) and isinstance(label, str) and label.strip():
            labels[source_id] = label
    return labels


def present_fdi_for_patient(source_dir: Path, source_id: str, arches: list[str] | None = None) -> list[int]:
    present: set[int] = set()
    for jaw in arches or patient_arches(source_dir):
        vertices, _faces = convert_patient.load_obj(source_dir / f"{source_id}_{jaw}.obj")
        labels = convert_patient.load_labels(
            source_dir / f"{source_id}_{jaw}.json",
            len(vertices),
            source_id,
            jaw,
        )
        for value in np.unique(labels):
            fdi = int(value)
            if fdi != 0:
                present.add(fdi)
    return sorted(present)


def triangle_count_glb(path: Path) -> int:
    scene = trimesh.load(path, process=False, force="scene")
    total = 0
    for geometry in scene.geometry.values():
        total += len(geometry.faces)
    return int(total)


def build_cohort(
    source_root: Path,
    cohort_path: Path,
    manifest_path: Path,
    out_dir: Path,
    limit: int | None,
    convert: bool,
) -> None:
    discovered = discover_source_ids(source_root)
    chosen = discovered if limit is None else discovered[:limit]
    previous_labels = load_previous_labels(cohort_path)

    print("selection_report:")
    print(f"  scanned={source_root}")
    print(f"  complete_patients_found={len(discovered)}")
    print(f"  order=sha256(sourceId) ascending, then sourceId")
    print(f"  limit={'none' if limit is None else limit}")
    print(f"  chosen={len(chosen)}")
    for index, source_id in enumerate(chosen, start=1):
        print(f"  {index:02d} {source_id} hash={source_id_hash(source_id)[:12]}")

    cohort: list[dict] = []
    manifest: list[dict] = []
    out_dir.mkdir(parents=True, exist_ok=True)
    pad = max(3, len(str(len(chosen))))

    for index, source_id in enumerate(chosen, start=1):
        patient_id = f"patient-{index:0{pad}d}"
        file_name = f"{patient_id}.glb"
        source_dir = source_root / source_id
        output = out_dir / file_name
        arches = patient_arches(source_dir)
        present = present_fdi_for_patient(source_dir, source_id, arches)
        missing = case_tags.missing_from(present, arches=arches)
        tags = case_tags.case_tags(present, arches=arches)
        counts = case_tags.tooth_count_by_arch(present)
        title = f"Case {index}"
        summary = case_tags.summary_line(present, arches=arches)
        # Always regenerate so the legacy `label` number matches patient-NN / Case N.
        # previous_labels is only consulted when debugging renumber diffs (printed below).
        label = case_tags.descriptive_label(index, present, arches=arches)
        old_label = previous_labels.get(source_id)
        if old_label and old_label != label:
            print(f"  label_renumber {source_id}: {old_label!r} -> {label!r}")

        if convert:
            convert_patient.convert_patient(source_dir, source_id, output, jaws=arches)
            print(f"converted {patient_id} <- {source_id} arches={','.join(arches)} bytes={output.stat().st_size}")
        elif not output.is_file():
            raise FileNotFoundError(f"missing GLB for {patient_id}: {output} (pass without --no-convert)")

        bytes_size = output.stat().st_size
        triangles = triangle_count_glb(output)

        cohort.append(
            {
                "id": patient_id,
                "sourceId": source_id,
                "label": label,
                "file": file_name,
                "arches": arches,
            }
        )
        manifest.append(
            {
                "id": patient_id,
                "label": label,
                "title": title,
                "summary": summary,
                "file": file_name,
                "arches": arches,
                "presentFdi": present,
                "missingFdi": missing,
                "toothCount": counts,
                "hasThirdMolars": case_tags.has_third_molars(present, arches=arches),
                "bytes": bytes_size,
                "triangleCount": triangles,
                "tags": tags,
            }
        )

    cohort_path.write_text(json.dumps(cohort, indent=2) + "\n", encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {cohort_path.relative_to(REPO_ROOT)} ({len(cohort)} entries, with sourceId)")
    print(f"wrote {manifest_path.relative_to(REPO_ROOT)} ({len(manifest)} entries, no sourceId)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build stable cohort + public patient manifest")
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--cohort", type=Path, default=DEFAULT_COHORT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--limit", type=int, default=None, help="take only the first N after hash sort")
    parser.add_argument(
        "--no-convert",
        action="store_true",
        help="reuse existing GLBs (still rewrite manifests)",
    )
    args = parser.parse_args()
    try:
        build_cohort(
            source_root=args.source_root,
            cohort_path=args.cohort,
            manifest_path=args.manifest,
            out_dir=args.out_dir,
            limit=args.limit,
            convert=not args.no_convert,
        )
    except Exception as exc:  # noqa: BLE001 — CLI boundary
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
