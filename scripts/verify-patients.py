"""Check converted GLBs against the source scans and cohort labels."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
import trimesh

REPO_ROOT = Path(__file__).resolve().parents[1]

spec = importlib.util.spec_from_file_location(
    "convert_patient", REPO_ROOT / "scripts" / "convert-patient.py"
)
convert_patient = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(convert_patient)


def expected_nodes(source_dir: Path, source_id: str) -> set[str]:
    names = {"Upper", "Lower"}
    for jaw in ("upper", "lower"):
        vertices, _faces = convert_patient.load_obj(source_dir / f"{source_id}_{jaw}.obj")
        labels = convert_patient.load_labels(
            source_dir / f"{source_id}_{jaw}.json",
            len(vertices),
            source_id,
            jaw,
        )
        present = {int(value) for value in np.unique(labels)}
        for label in present:
            names.add(convert_patient.node_name(jaw, label))
    return names


def gltf_node_names(path: Path) -> list[str]:
    data = path.read_bytes()
    json_length = int.from_bytes(data[12:16], "little")
    document = json.loads(data[20 : 20 + json_length])
    return [node.get("name", "") for node in document["nodes"]]


def check_patient(entry: dict[str, str], source_root: Path, out_dir: Path) -> str:
    source_dir = source_root / entry["sourceId"]
    output = out_dir / entry["file"]
    source_faces = 0
    chunks = []
    for jaw in ("upper", "lower"):
        vertices, faces = convert_patient.load_obj(source_dir / f"{entry['sourceId']}_{jaw}.obj")
        source_faces += len(faces)
        chunks.append(vertices)
    source_keys = {tuple(point.tolist()) for point in np.vstack(chunks).astype(np.float32)}

    scene = trimesh.load(output, process=False, force="scene")
    output_faces = 0
    missing = 0
    for geometry in scene.geometry.values():
        output_faces += len(geometry.faces)
        for point in np.asarray(geometry.vertices, dtype=np.float32):
            if tuple(point.tolist()) not in source_keys:
                missing += 1

    names = set(gltf_node_names(output))
    expected = expected_nodes(source_dir, entry["sourceId"])
    size = output.stat().st_size
    problems = []
    if output_faces != source_faces:
        problems.append(f"faces {output_faces} != {source_faces}")
    if missing:
        problems.append(f"{missing} vertices are not source float32 positions")
    if names != expected:
        problems.append(f"missing {sorted(expected - names)} extra {sorted(names - expected)}")
    if size > 25 * 1024 * 1024:
        problems.append(f"larger than 25 MB ({size})")
    status = "ok" if not problems else "FAIL " + "; ".join(problems)
    return f"{entry['id']} {size} faces={output_faces} nodes={len(names)} {status}"


def main() -> None:
    cohort = json.loads((REPO_ROOT / "scripts" / "cohort.json").read_text(encoding="utf-8"))
    source_root = REPO_ROOT / "raw-data" / "selected"
    out_dir = REPO_ROOT / "public" / "data"
    total = 0
    failed = False
    for entry in cohort:
        line = check_patient(entry, source_root, out_dir)
        total += (out_dir / entry["file"]).stat().st_size
        print(line)
        failed = failed or "FAIL" in line
    print(f"total_bytes={total}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
