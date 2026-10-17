# Open Dental Atlas — implementation handoff

This document describes the code as it exists on branch `phase-7-ui-polish`. It is written so another engineer or model can change the app without rediscovering the data format, coordinate system, or interaction rules.

When this file and an older document disagree, trust the source files named here. Several planning docs are stale. Those are called out in [Status versus written plans](#status-versus-written-plans).

## Product

A static browser viewer for real intraoral dental scans. A visitor orbits a patient's upper and lower crowns, toggles tooth types and gingiva, separates the teeth, and clicks a tooth to see its FDI number and name. Twelve anonymized patients from Teeth3DS+ are bundled as GLB files. There is no backend, no accounts, and no database.

The educational point is real patient variation (missing teeth, different arches), not an idealized reference skull.

Out of scope, and not implemented:

- Pathology or disease stages
- AI chat
- The full ~900-patient dataset
- User accounts, a server, or a database
- Segmentation-model comparison
- Hosting or a public demo

## Status versus written plans

| Source | What it is | Trust it for |
| --- | --- | --- |
| This file and the `src/` / `scripts/` code | Current behavior | Implementation |
| `docs/adr/0001-patient-glb-layout.md` | GLB layout decision | Still accurate |
| `docs/adr/0002-tooth-picking.md` | Why picking uses raycasts and cloned materials | The picking method is still accurate. The consequence that says only the lower arch is shown is **stale**. Both jaws, occlusion, layers, explode, and isolate are implemented. |
| `PROJECT_PLAN.md` | Original v1 spec and phase order | Intent, license caution, non-goals. The built viewer already exceeds the phase list (both jaws, layer toggles, explode, isolate, type colors, studio chrome). |
| `README.md` | Public readme | Skeleton only. Phase 6 documentation was not written. |
| `tasks/plan.md`, `tasks/todo.md` | Phase 3 task notes | Historical. Do not treat the unchecked merge checkbox as the current git state. Phase 3 was merged and tagged. |
| `ATTRIBUTION.md` | Dataset credit | Required on any page that shows scans. The 12-patient count is current. |

Git, as of this writing:

- Current branch: `phase-7-ui-polish`
- `main` is `7daac65` (`chore: merge phase 5 search`)
- Local tags: `v0.1-phase0` through `v0.1-phase5`
- There is no `phase-6` branch. Phase 7 is UI motion and reskinned controls on top of phase 5, not a new 3D feature.
- `origin/main` exists. The original plan said not to push. Do not push unless the human asks.
- Phase branches `phase-0-bootstrap` through `phase-5-search` still exist locally.

Untracked archives `um96h-osfstorage-archive.zip` and `xctdy-osfstorage-archive.zip` in the repo root are raw OSF downloads. Do not commit them. `raw-data/` is gitignored for the same reason.

## Constraints that must not be broken

**License.** Teeth3DS+ is CC BY-NC-ND 4.0. Application code is MIT (`LICENSE`). The MIT license does not cover the scans.

- Keep GLB conversion lossless and technical. Do not smooth, decimate, weld, or reshape vertices in `scripts/convert-patient.py`. Do not mix one patient's geometry with another's.
- The only allowed position change in the file is glTF float32 rounding.
- Do not add sponsorship, ads, or commercial revenue tied to this project or its data.
- Keep the Ben-Hamadou / Teeth3DS+ credit and the links in `ATTRIBUTION.md` on every surface that shows the scans. The about sheet and tooth detail panel already do this.
- Dataset folder ids live only in `scripts/cohort.json` as `sourceId`. The public manifest (`src/data/patients.json`) uses `Patient N — …` labels. Do not put source ids in the UI.

**Display smoothing is not a license exception to copy back into the files.** `PatientModel` welds a **clone** at runtime so lighting has smooth normals. That clone is disposed with the view. The GLB on disk stays unwelded.

**Stack.** React 19, TypeScript, Vite, Three.js via React Three Fiber and Drei, Tailwind 4, shadcn/ui on Base UI, Framer Motion for chrome only. Node `>=22.13.0`. npm. No backend.

## How to run

```bash
npm install
npm run dev      # Vite dev server
npm run check    # tsc -b --noEmit
npm run lint     # oxlint
npm run test     # vitest, node environment, src/**/*.test.ts
npm run build    # tsc -b && vite build
npm run preview
```

Path alias `@` maps to `src/` (`vite.config.ts`, `tsconfig.app.json`).

Python conversion is separate and not part of `npm run dev`:

```bash
# from a local venv
pip install -r scripts/requirements.txt
python scripts/convert-patient.py --all
python scripts/verify-patients.py
```

Conversion reads `raw-data/selected/<sourceId>/` and writes `public/data/<file>`. The GLBs already in git are enough to run the viewer. Raw scans are not in git.

## Repository map

```
index.html                  title "Open Dental Atlas", mounts #root
src/main.tsx                StrictMode, TooltipProvider, index.css + studio.css
src/App.tsx                 renders ViewerShell only
src/components/ViewerShell.tsx   all UI state and overlay chrome
src/components/PatientSwitcher.tsx
src/components/ToothDetailPanel.tsx
src/components/ToothSearchPanel.tsx
src/components/StudioButton.tsx  shadcn Button + motion hover/tap
src/components/ui/*         shadcn / Base UI primitives
src/three/DentalScene.tsx   Canvas, lights, camera, orbit, error boundary
src/three/PatientModel.tsx  GLB load, materials, explode, picking
src/three/model-space.ts    visibility, arch pose, camera framing
src/three/pointer-tap.ts    tap versus drag/pinch
src/studio-state.ts         layer, arch, and view constants
src/studio-motion.tsx       reduced-motion-aware Framer transitions
src/studio.css              the entire studio layout (not Tailwind utilities)
src/index.css               Tailwind 4 + shadcn theme tokens
src/data/fdi-teeth.ts       32 permanent teeth
src/data/fdi-search.ts      search ranking
src/data/tooth-notes.ts     short educational blurbs
src/data/patients.ts        manifest parser
src/data/patients.json      public 12-patient list
scripts/convert-patient.py  OBJ + label JSON -> one GLB
scripts/verify-patients.py  face count, float32 positions, node names, 25 MB cap
scripts/cohort.json         id, sourceId, label, file
scripts/requirements.txt    numpy>=2, trimesh>=4.5
public/data/patient-01.glb … patient-12.glb
docs/adr/0001-patient-glb-layout.md
docs/adr/0002-tooth-picking.md
```

`src/components/ui/sheet.tsx` is present and unused by app code. Search uses `command.tsx`, which uses `dialog.tsx` and `input-group.tsx`. The visible studio controls are mostly custom-styled shadcn buttons, not a separate design system.

## Data pipeline

### Source files

Teeth3DS+ label JSON, confirmed in this dataset:

```json
{ "id_patient": "<sourceId>", "jaw": "upper" | "lower", "labels": [0, 36, ...], "instances": ... }
```

- `labels` has one integer per OBJ vertex and must match the vertex count.
- `0` is gingiva or other non-tooth surface.
- Non-zero values are FDI numbers.
- Files are named `{sourceId}_{jaw}.obj` and `{sourceId}_{jaw}.json`.
- Upper and lower scans for one patient already share scanner coordinates. They are not aligned at runtime beyond the display transform in `archDisplay`.

The OBJ parser in `load_obj` reads only `v` and triangle `f` records. Vertex colors in the OBJ are ignored. Faces must be triangles. Indices are 1-based OBJ indices converted to 0-based.

### Face assignment (`assign_faces`)

Vertices are never moved. Each triangle gets one label:

1. If all three vertices share a label, the triangle gets that label.
2. If two vertices share a label and the third differs, the triangle gets the majority label.
3. If all three differ and any vertex is `0`, the triangle goes to gingiva.
4. Otherwise the triangle gets the first vertex's label.

`mesh_for_label` gathers those faces, keeps only the used vertices, and builds `trimesh.Trimesh(..., process=False)`. `process=True` would merge vertices and is forbidden. See ADR-001.

### GLB node graph

One `.glb` per patient, both jaws:

```
Scene
  Upper
    FDI-11, FDI-12, …     (only teeth that have faces)
    Gingiva-upper
  Lower
    FDI-31, …
    Gingiva-lower
```

- Group nodes are exactly `Upper` and `Lower`, created with identity matrices.
- Tooth nodes are `FDI-{number}` (for example `FDI-36`). This is the contract the viewer raycasts against.
- Label `0` is kept as `Gingiva-upper` or `Gingiva-lower`.
- Names are passed as both `node_name` and `geom_name`.
- Gray OBJ vertex colors are not copied, so later lighting is not tinted by a constant color.

### Cohort

`scripts/cohort.json` is the conversion input. `src/data/patients.json` is the runtime manifest. They share `id`, `label`, and `file`. Only the cohort has `sourceId`.

| id | sourceId | public label | file |
| --- | --- | --- | --- |
| patient-01 | O9U99070 | Patient 1 — several missing teeth | patient-01.glb |
| patient-02 | N53MDM0A | Patient 2 — second and third molars absent | patient-02.glb |
| patient-03 | 7IGA0W6E | Patient 3 — upper left canine absent | patient-03.glb |
| patient-04 | 7IKF2TIW | Patient 4 — both upper canines absent | patient-04.glb |
| patient-05 | 8JYS0DD1 | Patient 5 — several second molars absent | patient-05.glb |
| patient-06 | NQ2A571C | Patient 6 — upper second molars absent | patient-06.glb |
| patient-07 | MGYSCSI9 | Patient 7 — lower right molars absent | patient-07.glb |
| patient-08 | 8MTEIYKY | Patient 8 — lower left second molar absent | patient-08.glb |
| patient-09 | 09BMUY86 | Patient 9 — third molars absent | patient-09.glb |
| patient-10 | 6XSU5W4B | Patient 10 — third molars absent | patient-10.glb |
| patient-11 | MAIPESOV | Patient 11 — third molars absent | patient-11.glb |
| patient-12 | MXWIBTGF | Patient 12 — lower right third molar present | patient-12.glb |

`verify-patients.py` checks, per patient:

- Output face count equals the sum of both source OBJs.
- Every output vertex, as float32, exists in the stacked source vertices.
- glTF node names equal `{Upper, Lower}` plus one node per label present in the source JSON (including 0).
- File size is at most 25 MB.

`parsePatients` in `src/data/patients.ts` requires a non-empty string `id`, a non-blank `label`, a `file` ending in `.glb`, and unique ids. `patientModelUrl` returns `/data/${file}`, which Vite serves from `public/data/`.

Models are not preloaded. `useGLTF(modelUrl)` fetches a file only when that patient is selected. Drei caches by URL, so switching back does not refetch. `PatientModel` is keyed by `patientKey`, so each selection prepares a fresh clone.

## FDI model

`src/data/fdi-teeth.ts` builds all 32 permanent teeth. FDI is `quadrant * 10 + digit`.

Quadrants:

| Quadrant | Arch | Side | Name prefix |
| --- | --- | --- | --- |
| 1 | upper | right | Upper right |
| 2 | upper | left | Upper left |
| 3 | lower | left | Lower left |
| 4 | lower | right | Lower right |

Digits: 1 central incisor, 2 lateral incisor, 3 canine, 4 first premolar, 5 second premolar, 6 first molar, 7 second molar, 8 third molar.

`getFdiTooth` throws on an unknown number. Call `parseFdiNodeName` first.

`parseFdiNodeName` matches `/^FDI-(\d+)$/` and returns the number only when that number is in the table. It returns `null` for gingiva, `FDI-0`, `FDI-99`, `FDI-36-extra`, `fdi-36`, `Upper`, and empty strings. Matching is case-sensitive.

`tooth-notes.ts` maps type to one educational sentence. `SCAN_NOTE` says the model is a crown surface and does not include roots or bone. These strings are the detail-panel copy.

### Search (`fdi-search.ts`)

`searchFdiTeeth`:

- Trims, lowercases, and strips a leading `fdi` plus space or hyphen (`fdi-23` searches `23`).
- Empty query returns all 32 teeth sorted by FDI number.
- Rank 0: exact FDI string or exact name.
- Rank 1: FDI or name starts with the term.
- Rank 2: FDI or name contains the term.
- Results sort by rank, then FDI number.

`missingToothMessage` is `FDI ${fdi}, ${name}, is not in this scan.`

The search list always shows the chart tooth even when the current scan lacks it. Absence is a label (`Not in this scan`) plus a notice if that result is the only hit and it is absent. Picking an absent tooth does not move the camera. It sets the notice and the live region.

## Runtime architecture

```
main.tsx
  TooltipProvider delay={300}
    App
      ViewerShell          React state for patient, studio, selection, panels
        DentalScene        R3F Canvas
          StudioEnvironment
          SelectionGestures
          OrbitControls
          CameraDirector
          StudioPlatform
          group rotation={[-π/2, 0, 0]}
            PatientModel   useGLTF + per-frame pose
        overlays           header, layers, search, detail, about, dock
```

`ViewerShell` owns selection and studio state. The canvas reports pieces, hover, select, and clear. It does not own the FDI panel.

### ViewerShell state

| State | Role |
| --- | --- |
| `session` | Incremented on reload. Becomes `key` on `DentalScene`, which remounts the canvas after an error. |
| `activePatientId` | Defaults to `patients[0]` (`patient-01`). |
| `studio` | `StudioState`. See below. |
| `pieces` | `ModelPiece[]` reported after the GLB is prepared. Empty until then. |
| `ready` | True after `PatientModel` finishes prepare. |
| `error` | String replaces the canvas with `ErrorCard`. |
| `hoveredFdi`, `hoverPoint` | Mouse hover tooltip. |
| `selectedFdi` | Open detail panel. |
| `panel` | `"layers" \| "search" \| null`. Layers panel is always visible on desktop; `panel === "layers"` only opens the mobile sheet. |
| `about` | About dialog. |
| `query`, `searchNotice` | Search box and the explicit miss/loading message. |
| `focusFdi`, `focusSerial` | Camera framing for a search pick. `focusSerial` increments so the camera director re-steers even if the pose math is unchanged. |
| `announcement` | `aria-live="polite"` text. |

`scanReady` is `ready && presentFdi.size > 0`. `presentFdi` is the set of FDI numbers in `pieces`.

`initialStudio` (`studio-state.ts`):

```ts
{
  arches: ["lower"],
  layers: ["incisor", "canine", "premolar", "molar"],
  gingiva: true,
  view: "three-quarter",
  rotate: false,
  explode: 0,      // 0..1
  isolate: false,
  reset: 0,        // camera intro token; never reset back to 0 on purpose
}
```

Views: `three-quarter` (¾), `occlusal` (O), `front` (F), `side` (S).

Layer colors, also used as tooth tints:

| id | name | color |
| --- | --- | --- |
| incisor | Incisors | `#c6a15a` |
| canine | Canines | `#d08a62` |
| premolar | Premolars | `#6e9084` |
| molar | Molars | `#5d7c9a` |
| gingiva | Gingiva | `#c45c58` |

### Interaction rules

`chooseTooth(fdi, fromSearch)`:

- If the click is not from search and that tooth's arch is not in `studio.arches`, ignore it. The arch list is read from a ref so the callback stays stable.
- Sets `selectedFdi`, closes search and about, clears `searchNotice`.
- From search: sets `focusFdi`, increments `focusSerial`, forces `explode` to 0, and if the tooth's arch is hidden, replaces `arches` with `[tooth.arch]` (not occlusion). Also adds `tooth.type` to `layers` if it was off.
- From a click: clears `focusFdi` unless it is already that same tooth.
- Always sets `isolate: false` and `rotate: false`.
- Announces `Selected FDI ${n}, ${name}`.

`clearSelection`: clears `selectedFdi` and `focusFdi`, sets `isolate: false`. Escape, the panel close control, a gingiva hit, and a tap on empty space all call this.

`switchPatient`: if the id changes, clears ready, pieces, hover, selection, focus, search notice, announcement, and the open panel. Studio keeps arches, layers, gingiva, and view. It zeroes explode, isolate, and rotate, and increments `reset` so the camera replays its intro. Then sets the new patient id.

`resetStudio`: back to `initialStudio` except `reset` increments. Also clears selection, hover, focus, query, and the panel.

Arch tabs (`setArchMode`): upper, lower, or occlusion (`["upper", "lower"]`). Clears selection, focus, and hover, and turns isolate off.

Layer presets:

- All: four tooth layers, gingiva on.
- Teeth: four tooth layers, gingiva off.
- Molars: only `molar`, gingiva off.
- Hide all: `layers: []`, gingiva off.
- A row click (`soloLayer`) shows only that type and hides gingiva.
- The switch toggles one type without turning the others off. An empty layer list is allowed.
- Gingiva has its own switch. The gingiva name button toggles gingiva only.

Explode slider: `0..100` mapped to `0..1`. Any move sets `rotate` false. `explode > 0` clears isolate.

Isolate button in the detail panel toggles `isolate`, and forces explode and rotate off. Isolate shows only `selectedFdi`.

Keyboard, window listener:

- `/` opens search unless the event target is an input, textarea, or select.
- Escape closes about, otherwise the search/layers panel, otherwise the selection.

`posedView` is `occlusal` when `explode > 0.8`, otherwise `studio.view`. View buttons other than occlusal are disabled in that range. Auto-rotate is disabled when `explode >= 0.4` or isolate is on.

Scene caption (`sceneCaption`), in priority order: isolated tooth name, `EVERY TOOTH` (explode > 0.85), `OPENING THE BITE` (explode > 0.05), `IN OCCLUSION`, `UPPER ARCH` / `LOWER ARCH`, `CROWNS ONLY` when gingiva is off, otherwise `DENTAL ARCH`.

Hover tooltip is positioned at the pointer plus an offset, clamped to the viewport. It shows `hoveredTooth.name`. Touch does not set hover.

## 3D scene

### Coordinates

Scanner meshes are **Z-up**, with the front of the arch toward **−Y**. Crowns point toward **+Z**. Both jaws are stored facing the same way.

`DentalScene` wraps the model in:

```tsx
<group rotation={[-Math.PI / 2, 0, 0]}>
```

That makes scanner +Z become world +Y (up) and scanner −Y become world +Z (toward the default camera).

`modelPointToWorld([x, y, z])` returns `Vector3(x, z, -y)`. Use this for any camera or stage math. Do not apply a second rotation if the point is already in that group.

`PatientModel` moves meshes in **scanner space**. `archDisplay` and the explode offsets are scanner-space too. The world rotation happens on the parent group.

### Upper arch display (`archDisplay`)

The upper jaw is not a second file. It is the same scan, mirrored so the crowns point down.

- Lower-only: both arches stay at rest (no mirror). The upper mesh is hidden by `pieceVisible` because its arch is off.
- Upper shown: `mirrorZ: true`, `pivotZ` is the midpoint of the upper bounds' Z. A point `z` becomes `2 * pivotZ - z`. Implemented as `mesh.scale.z = -1` plus a position rewrite, not as a negative geometry.
- Occlusion (both arches): the mirrored upper arch is lifted on Z so its crowns sit just above the lower arch.

```
gap = max(lowerSize.z, upperSize.z) * 0.08
offsetZ = lowerBox.max.z + gap - upperBox.min.z
```

- Upper-only: mirror, no lift. `stageAbove` is true, so the platform sits above the arch (the crowns point down, so the "floor" is on the root side, which is world-up after the group rotation... `studioPose` puts `floorY` at `box.max.y + 0.35` when `stageAbove`, else `box.min.y - 0.35`).

`displayedModelPoint` applies mirror and offset before `modelPointToWorld`.

### Visibility (`pieceVisible`)

A piece is visible when:

1. Its arch is in `filter.arches`, and
2. If `isolate`, its `fdi` equals `selectedFdi` (gingiva never passes), else
3. Gingiva follows `filter.gingiva`, and a tooth follows `filter.layers.includes(kind)`.

Hidden meshes set `raycast` to a no-op so they cannot be picked. Shown meshes use `Mesh.prototype.raycast`.

### Camera framing versus mesh visibility

`DentalScene` builds two filters:

- `filter` drives `PatientModel` and `StudioPlatform`.
- `cameraFilter` is `cameraFocusFilter(filter, focusFdi, pieces)`.

When `focusFdi` is set and that tooth is on a visible arch, the camera filter pretends `isolate: true` and `selectedFdi: focusFdi`. The meshes stay in the real filter, so a search pick frames one tooth while the rest of the arch remains visible. If the tooth is missing or on a hidden arch, the camera filter is unchanged.

`studioPose(pieces, filter, view, explode, fov)`:

- Returns `null` if nothing is visible.
- Bounds use displayed centers converted to world, with half-extents swapped to match the axis map: world half is `(halfX, halfZ, halfY)`.
- `explode > 0.8` and not isolate forces the direction to occlusal.
- `grow = isolate ? 0 : explode * 52`.
- `padding` is `1.7` when isolating, else `1.08`.
- `distance = max((radius + grow) / sin(fov/2) * padding, isolate ? 14 : 36)`.
- FOV is 34 degrees.
- View directions (then normalized): three-quarter `(0.46, 0.58, 0.84)`, occlusal `(0.02, 1, 0.04)`, front `(0, 0.3, 1)`, side `(1, 0.36, 0.22)`.
- Stage radius is `max(18, max(size.x, size.z) * 0.46)`.

`CameraDirector` (`useFrame`):

- On a new `patientKey:reset` revision, plays the intro again.
- Intro snaps the camera to the pose, then (unless reduced motion) pushes it 62 units further along the view direction so the next frames lerp in. Reduced motion snaps and marks settled immediately.
- Lerp factor is `1 - exp(-4.8 * dt)`. It settles when the camera is within `0.45` of the target pose.
- While steering or settled, damping stays on and the director does not fight OrbitControls.
- A user drag (`controls` start) sets `steer` and `settled`, so later UI changes do not yank the camera until a large pose change. A pose is "reframed" when position or target moves more than `0.5`.
- `focusSerial` changes cancel steer/settled so a search pick animates.
- Auto-rotate runs only when `rotate` is on, the camera is settled, the user is not steering, isolate is off, and `explode < 0.4`. Speed is `0.7`.
- Below 768px width, the pose offset is multiplied by `1.34` so the arch sits further back. `camera.clearViewOffset()` on small screens.
- At `>= 768px`, `setViewOffset` uses a virtual frame of `width * 1.2` by `height * 1.16`, offset by `width * 0.04` and `height * 0.1`, so the arch is not hidden behind the left panel and bottom dock.

OrbitControls (`makeDefault`):

- Damping factor `0.085`.
- Distance `6 .. 2400`.
- When `explode >= 0.8` (`spread`), left drag / one-finger is pan, and rotate is disabled. Otherwise left drag / one-finger orbits.
- Middle mouse and two-finger pinch zoom. Right drag pans.
- `autoRotate` on the control is false. The director turns it on.

Canvas camera: perspective, fov 34, near `0.5`, far `4000`, initial position `[70, 30, 150]`. DPR is `[1, 1.5]` under 768px and `[1, 2]` otherwise. `antialias`, opaque canvas, `powerPreference: "high-performance"`.

Desktop framing is a view offset, not a camera position hack. If you change panel widths, update `frameOffset` or the arch will sit under the chrome.

### Lighting and materials

Background `#8a969f` (same as `body` and `.studio`).

`StudioEnvironment` builds a `RoomEnvironment`, tints `BackSide` standard materials to `#e6d7ce`, and assigns a PMREM environment map. Tone mapping is `ACESFilmicToneMapping`, exposure `1.02`. The room and generator are disposed; the environment texture is disposed on cleanup.

Lights, no shadows:

- Hemisphere `#f4efe8` / `#6d7c8a`, intensity `0.55`
- Key directional `(-2.4, 5.2, 3.4)`, intensity `2.05`, `#fff6ee`
- Fill directional `(3.2, 1.8, -2.6)`, intensity `0.62`, `#d5e2f2`

Tooth template (`MeshPhysicalMaterial`, then **cloned per mesh**):

- color `#f3e4cf` before the type tint replaces it
- roughness `0.4`, metalness `0`, clearcoat `0.9`, clearcoatRoughness `0.16`, envMapIntensity `0.72`

After clone, tooth color is copied from `typeColors` (the layer hex values above).

Gingiva template, also cloned per mesh:

- color `#c45c58`, roughness `0.55`, sheen `0.7`, sheenColor `#ffc2b6`, sheenRoughness `0.42`, envMapIntensity `0.45`

`paintTooth`:

- Selected: color `#1ec8b8`, emissive `#0c7f8a`, intensity `0.9`. Wins over hover.
- Hover: keep the type color, emissive `#5f8794`, intensity `0.55`.
- Rest: type color, emissive black, intensity `0`.

Do not put every tooth on one shared material. A tint would recolor the whole arch. Gingiva is not painted by `paintTooth`.

`smoothForDisplay` clones geometry, deletes normals, `mergeVertices` with tolerance `1e-4`, and recomputes normals. This is display-only. `disposeClone` disposes those welded geometries and the cloned materials, not the cached GLTF scene.

### Explode

Tooth centers (not gingiva) are averaged to a centroid. Each piece gets a unit direction in XY away from that centroid. If the direction length is under 1, it falls back to `(0, -1, 0)`.

Per-frame, `amount` damps toward `filter.isolate ? 0 : explode` with `MathUtils.damp(..., 7, dt)`. Reduced motion snaps.

For each piece, with `spread = amount`:

```
radial = spread * (gingiva ? 10 : 34)
lift   = (arch === "upper" ? 1 : -1) * (gingiva ? 18 : 32)
scale  = (1, 1, pose.mirrorZ ? -1 : 1)
position.xy = rest.xy + dir.xy * radial + pose.offset.xy
position.z  = mirror
  ? 2 * pivotZ + spread * lift + pose.offset.z
  : rest.z + spread * lift + pose.offset.z
```

Gingiva fades as the teeth separate: `opacity = shown ? max(0, 1 - spread / 0.82) : 0`. It becomes transparent under `0.999`, stops depth writes at or below `0.25`, and hides at or below `0.04`.

`StudioPlatform` (disc, short cylinder, thin ring) hides when `isolate` or `explode > 0.52`. It is placed at `stageCenter` and rotated 180° on X when `stageAbove`.

### Picking

`PointerTap` (`pointer-tap.ts`) is the gate between a selection and an orbit drag:

- Mouse threshold 5px, touch 12px (`tapThreshold`).
- A second pointer sets `blocked` (pinch).
- Movement past the threshold sets `blocked`.
- `up` returns true only when that pointer is the sole active pointer and the gesture is not blocked.
- `cancel` blocks the gesture.

`SelectionGestures` listens on the canvas in the **capture** phase for pointer down, move, up, and cancel. On up it sets `armed.current`. OrbitControls still receives the event. Pointer down also clears hover and sets the cursor to grab.

`PatientModel` puts pointer handlers on the cloned scene primitive:

- `onPointerMove`: touch, or any buttons held, does not hover. Mouse move calls `onHover(fdi, client point)` and sets the cursor to `pointer` on a tooth, otherwise `grab`.
- `onPointerOut`: cursor grab, and `onLeave` if the object is a tooth.
- `onClick`: if `armed` is false, ignore. `fdiFromHit` walks parents. A name starting with `Gingiva` returns null and clears the selection. An `FDI-*` name selects. Anything else clears.
- `stopPropagation` on over, move, and click so the event does not fall through to another mesh.

`Canvas onPointerMissed` calls `onClear` only when `armed` is true. A gingiva hit is not a miss, which is why gingiva is handled in `onClick`.

If a future control captures the pointer and stops `pointerup` on the canvas, selection will break. The tap gate and the control must listen on the same element. ADR-002 records this.

### Loading and errors

- `useProgress()` from Drei drives the "Preparing the scan" card. The card stays until `ready`, which is set when prepare finishes, not when the progress event hits 100.
- `Suspense` around `PatientModel` has a null fallback. The overlay is outside the canvas.
- `SceneErrorBoundary` is both outside the canvas and around the model. A WebGL message in the error text is replaced with a browser-support sentence. Anything else shows the raw message.
- `webglcontextlost` on the canvas is prevented and surfaces `The 3D session was paused by your device. Reload to continue.`
- Reload clears the error, increments `session`, and remounts `DentalScene`.
- Canvas `fallback={null}` so a missing WebGL context does not render R3F's default DOM fallback on top of `ErrorCard`. There is a historical fix for the viewer unmounting while WebGL was actually available (`a63cebc`). Do not remove the canvas when WebGL exists.
- The canvas `aria-label` describes orbit, zoom, and tap.

## UI layout

`studio.css` is the layout. Tailwind is used inside shadcn primitives and for a few utility classes (`glass` is custom, not a Tailwind class). The page is one `100dvh` stage. The canvas is `.scene` (absolute fill). Chrome is `pointer-events` managed per control; the canvas receives drags around the panels.

Desktop:

- `.identity` top left: eyebrow, title "Dental Atlas 3D", `{n} scans · Teeth3DS+`, patient `<select>`.
- `.top-actions` top right: Find a tooth (`/`), About.
- `.arch-tabs`: Upper, Occlusion, Lower. `aria-pressed` marks the active mode.
- `.layers-panel` left: presets, five rows with a solo button and a switch, visible count, Hide all.
- `.view-controls` right edge, vertical: four views, rotate, reset. Tooltips on the left.
- `.scene-caption` bottom center.
- `.bottom-dock`: explode slider "Separate teeth", plus a reset. On mobile a Layers button is added.
- `.studio-footer`: interaction hint plus Teeth3DS+ / 3DTeethSeg / Source & credits.
- `.detail-sheet`: right card, from below the header to above the dock (`top: 108px; right: 112px; bottom: 172px; width: 310px`).
- `.search-panel`: top right, `min(360px, 100vw - 40px)`.
- `.about-backdrop` plus `.about-sheet` dialog. Clicking the backdrop closes it. The sheet stops propagation.
- `.part-hover`: floating tooth name.
- `.loading-layer`: centered glass card with a skeleton and a width-animated bar.

Breakpoints in `studio.css`:

- `max-width: 1100px`: narrower layers panel (220px), detail sheet 280px.
- `max-width: 767px`: layers panel hidden until `.mobile-open`; search icon-only (44px targets); view controls become a horizontal row; detail sheet becomes a bottom card (`max-height: 46dvh`); footer hint hides; safe-area insets applied. Search input font is 16px to avoid iOS zoom.
- `max-height: 620px` and `orientation: landscape`: layers and detail become side cards, caption and the scan count hide, dock stays centered.
- `prefers-reduced-motion: reduce`: CSS animations and transitions are forced off.

`useStudioMotion` (`framer-motion`'s `useReducedMotion`) zeroes panel and micro durations. `MotionCard` is `motion.create(Card)`. `StudioButton` lifts 1px on hover and scales to `0.98` on press unless reduced motion or disabled.

Detail panel focuses the `h2` (`tabIndex={-1}`) when `fdi` changes. It shows FDI, name, type blurb, scan note, quadrant (`Upper left · Q2`), type, a dataset link, Isolate / Show surrounding teeth, and Clear selection.

Search uses cmdk `Command` with `shouldFilter={false}` because filtering is done in `searchFdiTeeth`. Items use the FDI number as `value`. Absent rows get `is-absent`. The highlighted row has a shared `layoutId="search-highlight"`.

Live region: `.sr-only` paragraph with `aria-live="polite"`.

Buttons in the studio are `StudioButton`, which wraps the shadcn `Button` (`@base-ui/react/button`) and passes a `motion.button` through the `render` prop. Base UI's `render` prop is how the visual element is swapped. Do not replace it with Radix `asChild` patterns; this project is not on Radix.

`components.json`: style `base-nova`, CSS variables, `src/index.css`, lucide icons.

Primary button color is `#263b48`. Focus ring `#538d9a`. Font is Geist Variable, loaded from `@fontsource-variable/geist`.

## Tests

Vitest, `environment: "node"`, no jsdom, no WebGL. Tests cover pure functions only.

| File | Covers |
| --- | --- |
| `src/data/fdi-teeth.test.ts` | 32 teeth, FDI 36 name, `parseFdiNodeName` rejects |
| `src/data/fdi-search.test.ts` | empty query, rank, case, `fdi-` prefix, miss message |
| `src/data/patients.test.ts` | 12 patients, parser rejects, URL `/data/patient-01.glb` |
| `src/three/pointer-tap.test.ts` | 5px, 12px, second pointer, cancel |
| `src/three/model-space.test.ts` | axis map, upper mirror, occlusion lift, stage side, camera focus, visibility |

There is no component test and no test for `convert-patient.py`. `verify-patients.py` is the geometry check, and it needs `raw-data/selected`.

TypeScript is strict about unused locals (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`). Imports of types use `import type`. Lint is oxlint with `react/rules-of-hooks` as an error.

## Git workflow the repo has been using

The original plan: one branch per phase, small conventional commits (`feat:`, `fix:`, `chore:`, `docs:`), merge to `main` with `--no-ff`, tag `v0.1-phaseN`, no force-push. Phases 0–5 followed that. Phase 7 is the open branch and is not tagged.

Do not commit `raw-data/`, `.venv/`, the OSF zips, `.env`, or `.cursor/skills/`.

## Guidance for further work

Safe extension points:

- Add a patient by converting with the existing script, appending `scripts/cohort.json` and `src/data/patients.json` with the same `id` / `label` / `file`, and putting the GLB in `public/data/`. Run `verify-patients.py` if the raw scan is available. Update the patient count in `ATTRIBUTION.md` if the count changes. Labels must stay anonymized and must not include `sourceId`.
- Add a tooth-type blurb in `TYPE_NOTES`. The detail panel reads `toothSummary`.
- Add a camera view by extending `StudioView`, `STUDIO_VIEWS`, and `VIEW_DIRECTION` together.
- Change picking only if `FDI-{number}` names and the tap gate stay intact. New meshes that should not select must not use that name pattern.

Easy to break:

- Sharing one tooth material, or forgetting to clone, recolors every tooth.
- Running `process=True` or welding inside `convert-patient.py` changes the licensed geometry.
- Applying explode offsets in world space instead of scanner space doubles the parent rotation and the arch flies apart on the wrong axis.
- Treating `onPointerMissed` as the only deselect path makes gingiva clicks do nothing.
- Resetting `studio` on patient change will surprise users who set occlusion and then switch patients. The current code intentionally keeps arches, layers, gingiva, and view.
- `cameraFocusFilter` isolate is for the camera only. Wiring that filter into `PatientModel` would hide the rest of the arch on search.
- Removing the desktop `setViewOffset` lets the left panel cover the arch.
- Stopping `pointerup` on the canvas breaks selection even if `onClick` still fires, because `armed` never becomes true.

Stale comments and docs to ignore or update if you touch them:

- ADR-002's line that upper teeth are removed before display.
- `tasks/plan.md` and `tasks/todo.md` (phase 3 checklist).
- `README.md` still says the repo is a bootstrap skeleton.
- `PROJECT_PLAN.md` phase 2 text that says the viewer loads the lower arch only. The current default is still the lower arch, but Upper and Occlusion are implemented.

Not built, and still out of scope unless the human expands it: pathology, chat, accounts, a server, the rest of the 900 patients, and deployment.
