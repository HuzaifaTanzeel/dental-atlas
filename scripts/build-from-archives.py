"""Build the full Teeth3DS+ cohort by reading data_part_*.zip directly.

- Dedupes by (sourceId, jaw): each labeled jaw appears once across all parts.
- Includes patients with upper, lower, or both (skips obj-only scans with no JSON).
- Pulls landmark/cusp JSONs from um96h-osfstorage-archive.zip when present.
- Pulls train/test split membership from xctdy-osfstorage-archive.zip.
- Writes scripts/cohort.json (with sourceId) and src/data/patients.json (public).
- Gender is NOT present per-patient in Teeth3DS+ (only cohort-level stats in the paper).

Usage:
  python scripts/build-from-archives.py              # convert all, resume existing GLBs
  python scripts/build-from-archives.py --limit 20
  python scripts/build-from-archives.py --force      # rebuild GLBs even if present
  python scripts/build-from-archives.py --manifest-only
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import sys
import time
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import trimesh

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "raw-data"
DEFAULT_COHORT = REPO_ROOT / "scripts" / "cohort.json"
DEFAULT_MANIFEST = REPO_ROOT / "src" / "data" / "patients.json"
DEFAULT_OUT_DIR = REPO_ROOT / "public" / "data"
DEFAULT_LANDMARK_DIR = DEFAULT_OUT_DIR / "landmarks"
UM96H = REPO_ROOT / "um96h-osfstorage-archive.zip"
XCTDY = REPO_ROOT / "xctdy-osfstorage-archive.zip"


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


def data_part_zips() -> list[Path]:
    return sorted(RAW_DIR.glob("data_part_*.zip"))


def index_scan_archives(zips: list[Path]) -> dict[str, dict[str, dict[str, tuple[Path, str]]]]:
    """sourceId -> jaw -> {obj|json: (zip_path, member_name)}."""
    index: dict[str, dict[str, dict[str, tuple[Path, str]]]] = defaultdict(lambda: defaultdict(dict))
    for zpath in zips:
        with zipfile.ZipFile(zpath) as zf:
            for name in zf.namelist():
                parts = name.replace("\\", "/").split("/")
                if len(parts) < 3 or parts[0] not in ("upper", "lower"):
                    continue
                jaw, source_id, fname = parts[0], parts[1], parts[-1]
                if not fname.endswith((".obj", ".json")):
                    continue
                ext = fname.rsplit(".", 1)[-1]
                expected = f"{source_id}_{jaw}.{ext}"
                if fname != expected:
                    continue
                existing = index[source_id][jaw].get(ext)
                if existing is not None:
                    raise ValueError(
                        f"duplicate {source_id} {jaw}.{ext}: {existing[0].name} and {zpath.name}"
                    )
                index[source_id][jaw][ext] = (zpath, name)
    return index


def labeled_arches(patient: dict[str, dict[str, tuple[Path, str]]]) -> list[str]:
    arches: list[str] = []
    for jaw in ("upper", "lower"):
        files = patient.get(jaw, {})
        if "obj" in files and "json" in files:
            arches.append(jaw)
    return arches


def read_zip_member(zpath: Path, member: str) -> bytes:
    with zipfile.ZipFile(zpath) as zf:
        return zf.read(member)


def load_label_meta_from_index(
    source_id: str,
    jaw: str,
    files: dict[str, tuple[Path, str]],
) -> dict[str, Any]:
    json_zip, json_member = files["json"]
    label_data = json.loads(read_zip_member(json_zip, json_member).decode("utf-8"))
    if label_data.get("id_patient") != source_id:
        raise ValueError(f"{json_member} id_patient mismatch")
    if label_data.get("jaw") != jaw:
        raise ValueError(f"{json_member} jaw mismatch")
    labels = label_data.get("labels") or []
    instances_raw = label_data.get("instances") or []
    instance_ids = sorted({int(value) for value in instances_raw if int(value) != 0})
    present = sorted({int(value) for value in labels if int(value) != 0})
    return {
        "id_patient": label_data.get("id_patient"),
        "jaw": label_data.get("jaw"),
        "vertexCount": len(labels),
        "faceCount": None,
        "instanceCount": len(instance_ids),
        "instances": instance_ids,
        "presentFdi": present,
        "labels": labels,
    }


def load_jaw_geometry_from_index(
    source_id: str,
    jaw: str,
    files: dict[str, tuple[Path, str]],
    label_meta: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    obj_zip, obj_member = files["obj"]
    obj_text = read_zip_member(obj_zip, obj_member).decode("utf-8")
    vertices, faces = convert_patient.load_obj_text(obj_text, source=obj_member)
    labels, _instances = convert_patient.parse_label_payload(
        {
            "id_patient": label_meta["id_patient"],
            "jaw": label_meta["jaw"],
            "labels": label_meta["labels"],
            "instances": label_meta.get("instances", []),
        },
        len(vertices),
        source_id,
        jaw,
        source=obj_member,
    )
    label_meta["faceCount"] = int(len(faces))
    label_meta["vertexCount"] = int(len(vertices))
    return vertices, faces, labels


def index_landmarks() -> dict[str, dict[str, dict[str, Any]]]:
    """sourceId -> jaw -> {counts, objects, key, version, description}."""
    if not UM96H.is_file():
        print(f"warn: landmarks archive missing: {UM96H}", file=sys.stderr)
        return {}
    out: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    with zipfile.ZipFile(UM96H) as outer:
        for nested_name in outer.namelist():
            if not nested_name.endswith(".zip"):
                continue
            split = "test" if "test" in nested_name.lower() else "train"
            with zipfile.ZipFile(io.BytesIO(outer.read(nested_name))) as inner:
                for member in inner.namelist():
                    if not member.endswith(".json"):
                        continue
                    base = Path(member).name
                    # e.g. 8MTEIYKY_lower__kpt.json
                    if "_lower" in base:
                        jaw = "lower"
                    elif "_upper" in base:
                        jaw = "upper"
                    else:
                        continue
                    source_id = base.split("_", 1)[0]
                    payload = json.loads(inner.read(member).decode("utf-8"))
                    objects = payload.get("objects") or []
                    counts = Counter(str(item.get("class", "Unknown")) for item in objects)
                    out[source_id][jaw] = {
                        "split": split,
                        "key": payload.get("key"),
                        "version": payload.get("version"),
                        "description": payload.get("description"),
                        "landmarkCount": len(objects),
                        "counts": dict(sorted(counts.items())),
                        "objects": [
                            {
                                "key": item.get("key"),
                                "class": item.get("class"),
                                "coord": item.get("coord"),
                            }
                            for item in objects
                            if isinstance(item, dict)
                        ],
                    }
    return out


def load_split_membership() -> dict[str, dict[str, str]]:
    """sourceId -> {upper?: train|test, lower?: train|test} from challenge split files."""
    membership: dict[str, dict[str, str]] = defaultdict(dict)
    if not XCTDY.is_file():
        print(f"warn: split archive missing: {XCTDY}", file=sys.stderr)
        return membership

    def ingest(text: str, jaw: str, split: str) -> None:
        for line in text.splitlines():
            token = line.strip()
            if not token:
                continue
            # lines may be source ids or filenames
            source_id = token.split("/")[-1].split("_")[0].split(".")[0]
            membership[source_id][jaw] = split

    with zipfile.ZipFile(XCTDY) as zf:
        for name in zf.namelist():
            low = name.replace("\\", "/").lower()
            if not low.endswith(".txt"):
                continue
            jaw = "upper" if "upper" in low else "lower" if "lower" in low else None
            if jaw is None:
                continue
            if "train" in low:
                split = "train"
            elif "test" in low:
                split = "test"
            else:
                continue
            ingest(zf.read(name).decode("utf-8"), jaw, split)
    return membership


def triangle_count_glb(path: Path) -> int:
    scene = trimesh.load(path, process=False, force="scene")
    return int(sum(len(geometry.faces) for geometry in scene.geometry.values()))


def write_landmark_sidecar(
    landmark_dir: Path,
    patient_id: str,
    jaw: str,
    landmark: dict[str, Any],
) -> str:
    landmark_dir.mkdir(parents=True, exist_ok=True)
    rel = f"landmarks/{patient_id}-{jaw}.json"
    path = DEFAULT_OUT_DIR / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(landmark, indent=2) + "\n", encoding="utf-8")
    return rel


def build(
    *,
    limit: int | None,
    force: bool,
    convert: bool,
    out_dir: Path,
    cohort_path: Path,
    manifest_path: Path,
) -> None:
    zips = data_part_zips()
    if not zips:
        raise FileNotFoundError(f"no data_part_*.zip under {RAW_DIR}")

    print("indexing scan archives…")
    index = index_scan_archives(zips)
    print("indexing landmarks…")
    landmarks = index_landmarks()
    print("loading train/test splits…")
    splits = load_split_membership()

    eligible: list[tuple[str, list[str]]] = []
    skipped_unlabeled = 0
    for source_id, jaws in index.items():
        arches = labeled_arches(jaws)
        if not arches:
            skipped_unlabeled += 1
            continue
        eligible.append((source_id, arches))
    eligible.sort(key=lambda item: (source_id_hash(item[0]), item[0]))
    if limit is not None:
        eligible = eligible[:limit]

    both = sum(1 for _, arches in eligible if arches == ["upper", "lower"])
    upper_only = sum(1 for _, arches in eligible if arches == ["upper"])
    lower_only = sum(1 for _, arches in eligible if arches == ["lower"])

    print("selection_report:")
    print(f"  archives={len(zips)}")
    print(f"  unique_source_ids={len(index)}")
    print(f"  skipped_unlabeled_obj_only={skipped_unlabeled}")
    print(f"  eligible={len(eligible)} (both={both}, upper_only={upper_only}, lower_only={lower_only})")
    print(f"  landmarks_patients={len(landmarks)}")
    print(f"  limit={'none' if limit is None else limit}")
    print(f"  convert={convert} force={force}")

    out_dir.mkdir(parents=True, exist_ok=True)
    cohort: list[dict[str, Any]] = []
    manifest: list[dict[str, Any]] = []
    pad = max(3, len(str(len(eligible))))
    started = time.time()

    for index_i, (source_id, arches) in enumerate(eligible, start=1):
        patient_id = f"patient-{index_i:0{pad}d}"
        file_name = f"{patient_id}.glb"
        output = out_dir / file_name

        jaw_meta: dict[str, Any] = {}
        present: set[int] = set()
        instance_count = {"upper": 0, "lower": 0}
        payloads: dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]] = {}

        need_geometry = convert and (force or not output.is_file())
        for jaw in arches:
            files = index[source_id][jaw]
            meta = load_label_meta_from_index(source_id, jaw, files)
            if need_geometry:
                vertices, faces, labels = load_jaw_geometry_from_index(source_id, jaw, files, meta)
                payloads[jaw] = (vertices, faces, labels)
            # Drop bulky per-vertex arrays before storing public meta.
            public_meta = {
                "vertexCount": meta["vertexCount"],
                "faceCount": meta["faceCount"],
                "instanceCount": meta["instanceCount"],
                "presentFdi": meta["presentFdi"],
            }
            jaw_meta[jaw] = public_meta
            instance_count[jaw] = meta["instanceCount"]
            present.update(meta["presentFdi"])

        present_list = sorted(present)
        missing = case_tags.missing_from(present_list, arches=arches)
        tags = case_tags.case_tags(present_list, arches=arches)
        counts = case_tags.tooth_count_by_arch(present_list)
        title = f"Case {index_i}"
        summary = case_tags.summary_line(present_list, arches=arches)
        label = case_tags.descriptive_label(index_i, present_list, arches=arches)

        landmark_public: dict[str, Any] | None = None
        if source_id in landmarks:
            landmark_public = {}
            for jaw, landmark in landmarks[source_id].items():
                rel = write_landmark_sidecar(DEFAULT_LANDMARK_DIR, patient_id, jaw, landmark)
                landmark_public[jaw] = {
                    "file": rel,
                    "landmarkCount": landmark["landmarkCount"],
                    "counts": landmark["counts"],
                    "split": landmark.get("split"),
                }
            if "has-landmarks" not in tags:
                tags.append("has-landmarks")
            if any("Cusp" in (entry.get("counts") or {}) for entry in landmark_public.values()):
                if "has-cusps" not in tags:
                    tags.append("has-cusps")

        split_info = splits.get(source_id) or {}

        if need_geometry:
            convert_patient.convert_patient_arrays(source_id, payloads, output)
            print(
                f"[{index_i}/{len(eligible)}] converted {patient_id} <- {source_id} "
                f"arches={','.join(arches)} bytes={output.stat().st_size}"
            )
        elif convert and output.is_file():
            print(f"[{index_i}/{len(eligible)}] reuse {patient_id} <- {source_id}")
        elif not output.is_file():
            raise FileNotFoundError(f"missing GLB for {patient_id}: {output}")

        bytes_size = output.stat().st_size
        triangles = triangle_count_glb(output)

        cohort_entry: dict[str, Any] = {
            "id": patient_id,
            "sourceId": source_id,
            "label": label,
            "file": file_name,
            "arches": arches,
        }
        cohort.append(cohort_entry)

        public_entry: dict[str, Any] = {
            "id": patient_id,
            "label": label,
            "title": title,
            "summary": summary,
            "file": file_name,
            "arches": arches,
            "presentFdi": present_list,
            "missingFdi": missing,
            "toothCount": counts,
            "instanceCount": instance_count,
            "hasThirdMolars": case_tags.has_third_molars(present_list, arches=arches),
            "bytes": bytes_size,
            "triangleCount": triangles,
            "tags": tags,
            "jawMeta": {
                jaw: {
                    "vertexCount": jaw_meta[jaw]["vertexCount"],
                    "faceCount": jaw_meta[jaw]["faceCount"],
                    "instanceCount": jaw_meta[jaw]["instanceCount"],
                    "presentFdi": jaw_meta[jaw]["presentFdi"],
                }
                for jaw in arches
            },
        }
        if landmark_public:
            public_entry["landmarks"] = landmark_public
        if split_info:
            public_entry["challengeSplit"] = split_info
        manifest.append(public_entry)

        if index_i % 25 == 0:
            elapsed = time.time() - started
            rate = index_i / elapsed if elapsed else 0
            eta = (len(eligible) - index_i) / rate if rate else 0
            print(f"  progress {index_i}/{len(eligible)} rate={rate:.2f}/s eta={eta/60:.1f}m")

    cohort_path.write_text(json.dumps(cohort, indent=2) + "\n", encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    elapsed = time.time() - started
    print(f"wrote {cohort_path.relative_to(REPO_ROOT)} ({len(cohort)} entries)")
    print(f"wrote {manifest_path.relative_to(REPO_ROOT)} ({len(manifest)} entries)")
    print(f"done in {elapsed/60:.1f} minutes")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build full Teeth3DS+ cohort from zip archives")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true", help="rebuild GLBs even when present")
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="rewrite manifests using existing GLBs (still reads label JSON from zips)",
    )
    parser.add_argument("--cohort", type=Path, default=DEFAULT_COHORT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()
    try:
        build(
            limit=args.limit,
            force=args.force,
            convert=not args.manifest_only,
            out_dir=args.out_dir,
            cohort_path=args.cohort,
            manifest_path=args.manifest,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
