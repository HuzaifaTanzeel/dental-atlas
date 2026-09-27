"""Convert one Teeth3DS+ patient directory into a single lossless GLB.

Label JSON shape, confirmed on this dataset: id_patient, jaw, labels, instances.
labels has one FDI integer per OBJ vertex. 0 is non-tooth surface.

Geometry rules are recorded in docs/adr/0001-patient-glb-layout.md.
Trimesh merges vertices when process=True
(https://trimesh.org/trimesh.base.html#trimesh.base.Trimesh.__init__),
so every mesh is built with process=False. Scene grouping uses
Scene.add_geometry parent_node_name
(https://trimesh.org/trimesh.scene.scene.html#trimesh.scene.scene.Scene.add_geometry).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COHORT = REPO_ROOT / "scripts" / "cohort.json"
DEFAULT_SOURCE_ROOT = REPO_ROOT / "raw-data" / "selected"
DEFAULT_OUT_DIR = REPO_ROOT / "public" / "data"


def load_obj(path: Path) -> tuple[np.ndarray, np.ndarray]:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if line.startswith("v "):
                parts = line.split()
                if len(parts) < 4:
                    raise ValueError(f"{path}:{line_number} vertex is missing coordinates")
                vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
            elif line.startswith("f "):
                indices: list[int] = []
                for token in line.split()[1:]:
                    indices.append(int(token.split("/")[0]) - 1)
                if len(indices) != 3:
                    raise ValueError(f"{path}:{line_number} expected a triangle")
                faces.append((indices[0], indices[1], indices[2]))
    if not vertices or not faces:
        raise ValueError(f"{path} has no vertices or faces")
    return np.asarray(vertices, dtype=np.float64), np.asarray(faces, dtype=np.int64)


def load_labels(path: Path, vertex_count: int, source_id: str, jaw: str) -> np.ndarray:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("id_patient") != source_id:
        raise ValueError(f"{path} id_patient is {data.get('id_patient')}, expected {source_id}")
    if data.get("jaw") != jaw:
        raise ValueError(f"{path} jaw is {data.get('jaw')}, expected {jaw}")
    labels = np.asarray(data["labels"], dtype=np.int32)
    if labels.shape != (vertex_count,):
        raise ValueError(
            f"{path} has {labels.shape[0]} labels for {vertex_count} vertices"
        )
    return labels


def assign_faces(vertex_labels: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Return one label per face without moving any vertex."""
    corners = vertex_labels[faces]
    first, second, third = corners[:, 0], corners[:, 1], corners[:, 2]
    assigned = np.full(len(faces), -1, dtype=np.int32)

    same = (first == second) & (second == third)
    assigned[same] = first[same]

    pair_ab = (first == second) & (first != third)
    pair_ac = (first == third) & (first != second)
    pair_bc = (second == third) & (first != second)
    assigned[pair_ab] = first[pair_ab]
    assigned[pair_ac] = first[pair_ac]
    assigned[pair_bc] = second[pair_bc]

    unresolved = assigned < 0
    has_gingiva = (first == 0) | (second == 0) | (third == 0)
    assigned[unresolved & has_gingiva] = 0
    still = assigned < 0
    assigned[still] = first[still]
    return assigned


def mesh_for_label(
    vertices: np.ndarray, faces: np.ndarray, assigned: np.ndarray, label: int
) -> trimesh.Trimesh | None:
    chosen = faces[assigned == label]
    if len(chosen) == 0:
        return None
    used, inverse = np.unique(chosen, return_inverse=True)
    remapped = inverse.reshape(chosen.shape)
    return trimesh.Trimesh(vertices=vertices[used], faces=remapped, process=False)


def node_name(jaw: str, label: int) -> str:
    if label == 0:
        return f"Gingiva-{jaw}"
    return f"FDI-{int(label)}"


def add_jaw(
    scene: trimesh.Scene,
    source_dir: Path,
    source_id: str,
    jaw: str,
) -> list[str]:
    vertices, faces = load_obj(source_dir / f"{source_id}_{jaw}.obj")
    labels = load_labels(source_dir / f"{source_id}_{jaw}.json", len(vertices), source_id, jaw)
    assigned = assign_faces(labels, faces)
    parent = "Upper" if jaw == "upper" else "Lower"
    names: list[str] = []
    for label in sorted(int(value) for value in np.unique(assigned)):
        mesh = mesh_for_label(vertices, faces, assigned, label)
        if mesh is None:
            continue
        name = node_name(jaw, label)
        scene.add_geometry(
            mesh,
            node_name=name,
            geom_name=name,
            parent_node_name=parent,
        )
        names.append(name)
    if not names:
        raise ValueError(f"{source_id} {jaw} produced no meshes")
    return names


def convert_patient(source_dir: Path, source_id: str, output: Path) -> list[str]:
    scene = trimesh.Scene()
    identity = np.eye(4)
    scene.graph.update(frame_to="Upper", frame_from=scene.graph.base_frame, matrix=identity)
    scene.graph.update(frame_to="Lower", frame_from=scene.graph.base_frame, matrix=identity)
    names = add_jaw(scene, source_dir, source_id, "upper")
    names.extend(add_jaw(scene, source_dir, source_id, "lower"))
    output.parent.mkdir(parents=True, exist_ok=True)
    exported = scene.export(file_type="glb")
    if not isinstance(exported, bytes):
        raise TypeError("expected GLB bytes from trimesh Scene.export")
    output.write_bytes(exported)
    return names


def load_cohort(path: Path) -> list[dict[str, str]]:
    cohort = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(cohort, list) or not cohort:
        raise ValueError(f"{path} must be a non-empty array")
    return cohort


def convert_all(cohort_path: Path, source_root: Path, out_dir: Path) -> None:
    for entry in load_cohort(cohort_path):
        source_dir = source_root / entry["sourceId"]
        output = out_dir / entry["file"]
        names = convert_patient(source_dir, entry["sourceId"], output)
        print(f"{entry['id']} {output.name} nodes={len(names)} bytes={output.stat().st_size}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert Teeth3DS+ patients to GLB")
    parser.add_argument("patient_dir", nargs="?", type=Path)
    parser.add_argument("output", nargs="?", type=Path)
    parser.add_argument("--all", action="store_true", help="convert every cohort entry")
    parser.add_argument("--cohort", type=Path, default=DEFAULT_COHORT)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    if args.all:
        convert_all(args.cohort, args.source_root, args.out_dir)
        return
    if args.patient_dir is None or args.output is None:
        parser.error("pass a patient directory and output path, or --all")
    source_id = args.patient_dir.name
    names = convert_patient(args.patient_dir, source_id, args.output)
    print(f"{source_id} -> {args.output} ({len(names)} meshes)")


if __name__ == "__main__":
    main()
