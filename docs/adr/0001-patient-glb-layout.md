# ADR-001: One GLB per patient, both jaws, lossless tooth split

## Status
Accepted

## Date
2026-09-27

## Context
Phase 1 converts Teeth3DS+ `.obj` scans and per-vertex FDI label JSON into browser-ready `.glb` files. The project plan leaves two choices open: one file per jaw or one file per patient, and how to treat vertices labeled `0` (not a tooth). The dataset license is CC BY-NC-ND 4.0. Format conversion is kept technical: vertex positions are not edited, smoothed, decimated, or welded, and one patient's anatomy is never combined with another's.

The label file is `{ id_patient, jaw, labels, instances }`. `labels` is one integer per vertex and matches the OBJ vertex count. `0` is gingiva or other non-tooth surface. Tooth numbers are FDI. Upper and lower scans for the same patient already sit in the same scanner coordinate range.

Trimesh documents `Trimesh(..., process=True)` as removing non-finite values and merging vertices ([Trimesh constructor](https://trimesh.org/trimesh.base.html#trimesh.base.Trimesh.__init__)). `Scene.add_geometry` accepts `node_name`, `geom_name`, and `parent_node_name` ([Scene.add_geometry](https://trimesh.org/trimesh.scene.scene.html#trimesh.scene.scene.Scene.add_geometry)).

## Decision
Write one `.glb` per patient containing both jaws.

- Group nodes are `Upper` and `Lower`.
- Each tooth is a child mesh named `FDI-{number}`, for example `FDI-36`.
- Label `0` is kept as `Gingiva-upper` or `Gingiva-lower`, so that surface is not discarded.
- A triangle whose three vertices share a label stays with that label. A mixed triangle goes to the label shared by two vertices. If all three differ and any vertex is `0`, the triangle goes to gingiva. Positions are copied. Meshes are built with `process=False`.
- glTF stores positions as float32. That rounding is the only allowed position difference.
- The constant gray vertex color in the OBJ files is not copied. It carries no anatomy, and leaving it on would tint later lighting.

The public manifest uses `Patient N — …` labels derived from which FDI numbers are present. Dataset folder ids stay in `scripts/cohort.json` as `sourceId` so the conversion can be repeated. They are the dataset's own anonymized codes, not patient names.

## Alternatives Considered

### One GLB per jaw
- Pros: Smaller files, matches the raw archive layout.
- Cons: The manifest and later viewer are defined per patient, so every load would stitch two files.
- Rejected: Both jaws already share scanner space, and FDI numbers do not collide across jaws.

### Drop label 0
- Pros: Only selectable teeth remain.
- Cons: Throws away a large share of the scan.
- Rejected: That is discarded geometry, not a lossless repack.

### Let trimesh process the mesh
- Pros: Cleaner, welded meshes.
- Cons: `process=True` merges vertices and can change the index buffer.
- Rejected: The license caution forbids reshaping.

## Consequences
- Phase 2 loads one file per patient and can raycast on `FDI-*` node names.
- Gingiva is present and should not be treated as a tooth in the FDI lookup.
- File size is the sum of both jaws. Verification flags any patient file over about 25 MB.
