# Project Plan — Open Dental Atlas (v1)
**An open-source 3D viewer for real dental patient scans (Teeth3DS+)**

> **Read this first, Cursor Agent:** this file is the full spec + execution plan for this project. Work through the phases below **in order, one at a time**. After finishing each phase, run its verification checklist, commit the work on its own branch, merge to `main` locally, and only then move to the next phase. Do not skip ahead, do not build v2 features early, and do not push to any remote — see the Git Workflow section for exact rules.

---

## 1. What we're building and why

A browser-based 3D viewer that loads **real intraoral dental scans** from the Teeth3DS+ dataset and lets a visitor click on individual teeth to see their FDI number and name, and switch between different real patients to see genuine anatomical variation (crowding, missing teeth, malocclusion).

This does **not** exist publicly yet. Related open-source projects only visualize a single idealized reference skull (BodyParts3D):
- `human-atlas` (https://github.com/ashemag/human-atlas) — whole-body viewer, 2,234 meshes, one reference male anatomy
- `OMFAtlas` (https://github.com/choxos/OMFAtlas) — dental-specific viewer, same idealized single-skull approach plus hand-built pathology/development content

Nobody has built a public browser for **real patient variation** in dentistry. That's the gap this project fills, and it's genuinely useful to two audiences at once: dental-education people, and the existing MICCAI/3DTeethSeg research community who already knows this dataset (they currently only consume it as a raw ML training set).

### Non-goals for v1 (do not build these yet — this is what keeps scope from exploding)
- No pathology / disease-progression visualization (cavities, gum disease stages — that's a v2 idea requiring original modeling work)
- No AI chat / "ask this tooth a question" layer (v2 idea)
- No coverage of all 900 patients — 10 to 20 is the target for v1
- No user accounts, no backend, no database — fully static site, all data bundled/fetched as static assets
- No segmentation-model comparison tooling (that's a v2 idea aimed at the ML research crowd)
- No deployment/publishing yet — get it working locally and demo-ready; the human will handle actual hosting and remote repo creation

---

## 2. Data source and licensing — read carefully before touching data

**Dataset:** Teeth3DS+ (used for the MICCAI 3DTeethSeg'22 and 3DTeethLand'24 challenges)
- Project homepage: https://crns-smartvision.github.io/teeth3ds/
- Official access repo: https://github.com/abenhamadou/3DTeethSeg22_challenge (mirror: https://github.com/DCBIA-OrthoLab/3DTeethSeg22_challenge)
- Data download: https://osf.io/xctdy/
- Paper: https://arxiv.org/pdf/2210.06094.pdf
- 1,800 intraoral scans (23,999 annotated teeth) from 900 patients, upper and lower jaws, each tooth already labeled per-vertex with its FDI number

**License: CC BY-NC-ND 4.0** — Attribution, **Non-Commercial**, **No-Derivatives**.

**⚠️ Important caution — do not skip this:** the "No-Derivatives" clause is a real legal nuance for this project, because converting the raw `.obj` scan files into a different 3D format (e.g. glTF/GLB) and splitting them into per-tooth sub-meshes for interactivity could be argued to be a "derivative" of the licensed data. Common practice in the research community is to treat format conversion and technical repackaging for visualization as non-derivative (the underlying geometry/content is unchanged, just re-encoded), but this has not been legally tested. Practical steps to reduce risk:
- Keep every conversion **lossless and purely technical** (no altering vertex positions, no reshaping, no combining patients' anatomy together) — the sub-meshing is just re-organizing existing labeled data into a format a browser can render, not creating new content
- Never accept sponsorship, ads, or any commercial revenue tied to this specific project or its data
- Prominently attribute the dataset and its authors (Ben-Hamadou et al.) on every page that shows the data, and link back to the official dataset and challenge
- Before any public launch, email/open an issue with the dataset maintainers (contact info is on the project homepage above) letting them know about the project and asking if they're comfortable with it — a green light from the actual data owners is worth more than any amount of license-parsing, and is very likely to be given for a non-commercial educational visualization that credits them
- If this doc is ever revisited for a v2 that touches monetization, redo this legal check from scratch — it is not cleared for anything commercial

**Reference project to study before writing any code:** `human-atlas` (https://github.com/ashemag/human-atlas)
- Same core tech stack we're using here (React + Three.js + shadcn/ui)
- Good patterns to borrow: how it merges/batches geometry for performance, how per-structure GPU textures drive selection/highlight state, how the search UI works, how the mobile-responsive detail panel is laid out, how it separates "system layers" (toggle groups) from individual mesh selection
- Read its `README.md` and `ATTRIBUTION.md` for how it documents dataset provenance — copy that pattern for our own dataset attribution
- **Do not copy code verbatim** — it's a different dataset (schematic reference anatomy vs. real per-patient scans) and a different UI goal (whole body vs. single dental arch), so the actual component logic needs to be built fresh for this project's data shape. Borrow patterns and conventions, not files.

---

## 3. Tech stack (match human-atlas for consistency and easy pattern-borrowing)

- **Framework:** React + TypeScript, bundled with Vite
- **3D rendering:** Three.js (use `@react-three/fiber` + `@react-three/drei` if it speeds up development — Cursor's call, but keep raycasting/picking simple and performant either way)
- **UI components:** shadcn/ui + Tailwind CSS
- **Data conversion pipeline:** a one-time Python (preferred: `trimesh`) or Node.js preprocessing script, run locally, **not** part of the runtime app — converts raw Teeth3DS+ `.obj` + label JSON into per-tooth-labeled `.glb` files ready for the browser to load
- **Package manager:** npm (match human-atlas's `npm run dev` / `npm run build` conventions)
- **No backend.** Static site only. All patient model files are pre-converted and bundled as static assets in `/public/data/`.

---

## 4. Agent Skills setup for Cursor

This project should use Anthropic-style Agent Skills via the **addyosmani/agent-skills** pack (https://github.com/addyosmani/agent-skills — MIT licensed, portable `SKILL.md` format, works natively with Cursor's Agent Skills support).

**Install once, at the very start of Phase 0**, via the skills CLI:

```bash
npx skills add addyosmani/agent-skills --skill using-agent-skills
npx skills add addyosmani/agent-skills --skill spec-driven-development
npx skills add addyosmani/agent-skills --skill planning-and-task-breakdown
npx skills add addyosmani/agent-skills --skill incremental-implementation
npx skills add addyosmani/agent-skills --skill context-engineering
npx skills add addyosmani/agent-skills --skill source-driven-development
npx skills add addyosmani/agent-skills --skill frontend-ui-engineering
npx skills add addyosmani/agent-skills --skill git-workflow-and-versioning
npx skills add addyosmani/agent-skills --skill debugging-and-error-recovery
npx skills add addyosmani/agent-skills --skill code-review-and-quality
npx skills add addyosmani/agent-skills --skill performance-optimization
npx skills add addyosmani/agent-skills --skill browser-testing-with-devtools
npx skills add addyosmani/agent-skills --skill documentation-and-adrs
```

This installs each skill's `SKILL.md` into `.cursor/skills/`, where Cursor auto-discovers and loads them progressively. If the CLI is unavailable in this environment, manually clone the repo and copy the relevant `skills/<name>/` folders into `.cursor/skills/` per the pack's own `docs/cursor-setup.md`.

**Why these and not the full set of 25** (skip the rest for v1 — they're aimed at production services/APIs/teams, not a solo static-site v1):
- Skipped: `interview-me`, `idea-refine` (this document already is the spec — no need to re-derive it)
- Skipped: `constraint-driven-development`, `api-and-interface-design` (no API, no team quality-bar negotiation needed solo)
- Skipped: `test-driven-development` in its strict form — 3D rendering isn't meaningfully unit-testable; instead, apply light test coverage only to the data-loading/parsing utility functions (see Phase 1), not to rendering code
- Skipped: `security-and-hardening`, `observability-and-instrumentation`, `ci-cd-and-automation`, `deprecation-and-migration`, `shipping-and-launch` — all aimed at production services; irrelevant until this actually gets deployed, which is out of scope for this doc
- Skipped: `code-simplification`, `doubt-driven-development`, `api-and-interface-design` — nice-to-haves, apply informally if useful, not required

**How each installed skill is used in this project, concretely:**
| Skill | Where it applies here |
|---|---|
| `using-agent-skills` | Load first, every session — routes you to the right skill for whatever phase you're in |
| `spec-driven-development` | Treat this document itself as the PRD; don't re-write one |
| `planning-and-task-breakdown` | Break each phase below into the smallest verifiable tasks before touching code |
| `incremental-implementation` | One phase = one thin vertical slice = implement → verify → commit. Never batch multiple phases into one commit |
| `context-engineering` | When referencing human-atlas, pull only the specific file/pattern needed, not the whole repo, into context |
| `source-driven-development` | Ground every Three.js / React Three Fiber / glTF decision in official docs (threejs.org, docs.pmnd.rs) — don't guess at API shapes |
| `frontend-ui-engineering` | Component structure, responsive layout, WCAG basics for the viewer UI |
| `git-workflow-and-versioning` | Atomic commits, trunk-based local workflow, small diffs — see Section 5 |
| `debugging-and-error-recovery` | Structured triage when mesh loading/parsing breaks (very likely during Phase 1–2) |
| `code-review-and-quality` | Self-review gate before merging each phase's branch into `main` |
| `performance-optimization` | Loading real scan meshes can be heavy — measure before assuming it's fine, especially on mobile |
| `browser-testing-with-devtools` | Verify rendering, check console/network in the actual browser at the end of every phase |
| `documentation-and-adrs` | Record *why* behind the glTF conversion approach, the patient-subset choice, etc. as short ADRs |

---

## 5. Git workflow — local only, no remote

Cursor must:
1. Run `git init` at the project root as the very first action of Phase 0. Do **not** run `git remote add` and do **not** run `git push` at any point — there is no remote yet, the human will create it later.
2. Create an initial `main` branch with a `.gitignore` (node_modules, dist, build artifacts, `.env`, OS files) and commit it before writing any feature code.
3. For **each phase**, create a branch named `phase-N-short-description` (e.g. `phase-1-data-pipeline`), do all of that phase's work there, commit incrementally with small, atomic, conventional-style commits (`feat:`, `fix:`, `chore:`, `docs:`), run that phase's verification checklist, then merge the branch into `main` locally (`git checkout main && git merge phase-N-... --no-ff`) before starting the next phase's branch.
4. Tag the merge commit for each completed phase locally (e.g. `git tag v0.1-phase1`) so there's an easy rollback point if a later phase breaks something.
5. Never force-push, never rewrite shared history — irrelevant here since there's no remote, but keep the habit for when one gets added.

---

## 6. Phase-by-phase build plan

Each phase has: **Goal**, **Tasks**, **Reference to study**, **Verification / Definition of Done**, **Git branch**.

---

### Phase 0 — Bootstrap
**Goal:** empty-but-correct project skeleton, tooling in place, nothing feature-related yet.

**Tasks:**
- `git init`, `.gitignore`, initial commit on `main`
- Scaffold Vite + React + TypeScript project
- Install and configure Tailwind CSS + shadcn/ui (match human-atlas's setup approach)
- Install Three.js (and `@react-three/fiber` + `@react-three/drei` if used)
- Install and wire up the Agent Skills per Section 4
- Create folder structure:
  ```
  /public/data/            # converted per-patient .glb files go here (Phase 1)
  /scripts/                # data conversion scripts (Phase 1)
  /src/components/         # UI components
  /src/three/              # scene setup, loaders, raycasting logic
  /src/data/               # FDI name/number lookup tables, patient manifest
  /docs/adr/               # short architecture decision records
  ATTRIBUTION.md           # dataset + reference-project credits
  LICENSE                  # code license (MIT recommended, matching both reference projects)
  README.md                # skeleton for now, filled in properly in Phase 6
  ```
- Write `ATTRIBUTION.md` now, even though data isn't in yet — credit Teeth3DS+ / Ben-Hamadou et al. with links from Section 2, and credit human-atlas / OMFAtlas as design inspiration with their repo links
- Confirm `npm run dev` boots a blank page with no errors

**Reference to study:** human-atlas's `package.json` and top-level config files, for dependency versions and scripts naming conventions

**Verification:** app boots locally, lints clean, `git log` on `main` shows a clean bootstrap commit, `.cursor/skills/` populated

**Branch:** `phase-0-bootstrap`

---

### Phase 1 — Data acquisition and conversion pipeline
**Goal:** a repeatable script that takes raw Teeth3DS+ files for a small patient set and produces browser-ready, per-tooth-labeled `.glb` files.

**Tasks:**
- Pick 10–20 patients from Teeth3DS+ with varied cases if possible (e.g. some with visible crowding or a missing tooth, not just clean cases) — download their raw upper/lower `.obj` scans and label JSON from https://osf.io/xctdy/
- Write a one-time conversion script (`/scripts/convert-patient.py` or `.ts`) that:
  - Loads a patient's `.obj` mesh and its per-vertex/per-face FDI label data
  - Splits the single mesh into separate named sub-meshes, one per tooth, named by FDI number (e.g. `FDI-36`)
  - Exports the result as a single `.glb` per patient (per jaw, or combined — Cursor's call, document the choice in an ADR), preserving named nodes so the app can raycast and identify which tooth was hit by node name
  - Keeps geometry lossless — no smoothing, decimation, or reshaping (see the licensing caution in Section 2)
- Build a small FDI lookup table in `/src/data/fdi-teeth.ts` — FDI number → common name (e.g. `36` → "Lower left first molar") and quadrant/type metadata
- Build a `patients.json` manifest listing the converted patients with a short label (e.g. "Patient 1 — mild crowding") — do **not** include any real identifying patient information, only anonymized labels already provided by the dataset
- Light unit tests are appropriate here (per Section 4) — test the FDI lookup table and the manifest-parsing logic, not the 3D conversion itself

**Reference to study:** none directly (this pipeline is unique to this project's data), but check the Teeth3DS+ paper/repo for the exact label JSON schema before writing the parser

**Verification:** running the script on one patient produces a valid `.glb` that opens correctly in a standalone glTF viewer (e.g. https://gltf-viewer.donmccurdy.com/) with visibly separate, named tooth meshes; repeat for all chosen patients; total `/public/data/` size is reasonable for a web app (measure it, flag if any single patient file is unexpectedly large)

**Branch:** `phase-1-data-pipeline`

---

### Phase 2 — Core 3D viewer shell
**Goal:** a working scene that loads one patient's `.glb` and lets the user orbit/zoom around it. No interactivity yet beyond camera controls.

**Tasks:**
- Set up the Three.js scene: camera, lighting suited to dental scan geometry (these are unlit/untextured meshes typically — pick a lighting setup that reads the tooth shapes clearly, e.g. a simple three-point setup with soft shadows off for performance)
- Orbit controls (mouse + touch)
- Load and render one converted `.glb` from Phase 1
- Basic loading state (spinner/skeleton) while the model fetches
- Basic error boundary if a model fails to load

**Reference to study:** human-atlas's scene setup and camera/controls configuration — borrow the *pattern* (how it structures the Three.js scene as React components, how it handles the loading state), not literal code, since the geometry shape (whole body vs. single arch) differs

**Verification:** patient model loads and is orbit/zoom-able smoothly on both desktop and a real mobile device (or device emulation); no console errors; frame rate holds up reasonably (use `browser-testing-with-devtools` skill here)

**Branch:** `phase-2-viewer-shell`

---

### Phase 3 — Tooth selection and FDI labeling
**Goal:** click/tap a tooth, see its FDI number and name.

**Tasks:**
- Implement raycasting/picking against the named tooth sub-meshes from Phase 1
- Hover state: highlight the tooth under the cursor (color tint or outline)
- Click/tap state: select a tooth, open a detail panel showing FDI number, common name, quadrant/type (from the lookup table built in Phase 1)
- Deselect on clicking empty space / pressing Escape
- Mobile: tap-to-select works the same way, panel adapts to smaller screens

**Reference to study:** human-atlas's structure-selection and detail-panel pattern — it already solves "click a mesh, show its info in a panel," which is exactly this phase's problem, just at a different scale (2,234 structures vs. ~28-32 per patient)

**Verification:** every visible tooth in the loaded patient is individually selectable and shows correct FDI info; hover and click states are visually distinct; works via touch on mobile

**Branch:** `phase-3-tooth-selection`

---

### Phase 4 — Patient switcher
**Goal:** move between the 10–20 converted patients to see real anatomical variation.

**Tasks:**
- Build a patient list/switcher UI (sidebar or dropdown, driven by `patients.json` from Phase 1)
- Lazy-load each patient's `.glb` only when selected, not all upfront
- Clear the previous patient's model and selection state on switch
- Loading state per switch (reuse Phase 2's loading UI)

**Reference to study:** human-atlas's system-toggle / preset-switching UI conventions for a consistent look and interaction feel

**Verification:** switching between all converted patients works without memory leaks or stale selection state; loading feels responsive (measure switch time, apply `performance-optimization` skill if it's slow)

**Branch:** `phase-4-patient-switcher`

---

### Phase 5 — Search (lightweight, optional but recommended)
**Goal:** quickly jump to a tooth by FDI number or name, matching a pattern real users of human-atlas clearly valued.

**Tasks:**
- Simple search input filtering the FDI lookup table by number or name
- Selecting a search result selects and focuses the camera on that tooth in the currently loaded patient (if present in that patient — handle missing teeth gracefully, since real patients may have extractions)

**Reference to study:** human-atlas's search implementation for UX conventions (debounce, result list styling)

**Verification:** search returns correct matches instantly, selecting a result focuses the right tooth, gracefully handles a searched tooth not existing in the current patient (e.g. it was extracted)

**Branch:** `phase-5-search`

---

### Phase 6 — Polish, performance, and documentation
**Goal:** make it demo-ready.

**Tasks:**
- Full responsive pass (phone, tablet, desktop) using `frontend-ui-engineering` skill
- Performance pass: check load times, frame rate, bundle size; lazy-load/code-split where sensible
- Accessibility basics: keyboard focus states, adequate color contrast, alt text/labels on controls
- Write the real `README.md`: what it is, why it exists (the "real patient variation" pitch from Section 1), live demo link placeholder, credits linking to Teeth3DS+ and both reference projects, how to run locally, license
- Finalize `ATTRIBUTION.md` with exact patient count used and dataset version details
- Record a short screen-capture GIF of the app in action for the README (do this manually or flag for the human to do it)
- Add a couple of short ADRs to `/docs/adr/` documenting the key decisions made (glTF conversion approach, why 10-20 patients, tech stack choices)

**Reference to study:** human-atlas's `README.md` structure directly — it's a good model for how to present an open-source visualization project (short pitch, live demo link up top, clear credits section)

**Verification:** a fresh clone + `npm install` + `npm run dev` works with zero manual steps beyond that; README reads clearly to someone who's never seen the project; Lighthouse/DevTools performance pass is reasonable for a static 3D site

**Branch:** `phase-6-polish-docs`

---

## 7. Definition of Done for v1 (overall)

- [ ] 10–20 real Teeth3DS+ patients loaded, each with individually selectable, FDI-labeled teeth
- [ ] Smooth orbit/zoom/select interaction on both desktop and mobile
- [ ] Patient switcher works cleanly with lazy loading
- [ ] Search works (if Phase 5 completed)
- [ ] Clear, credited README and ATTRIBUTION.md
- [ ] Every phase is its own merged, tagged commit history on `main` — no remote pushed
- [ ] No v2 scope (pathology, AI chat, more patients, deployment) has crept in

## 8. What happens after v1 (not now — just so Cursor doesn't wander here early)

Once v1 is working and the human has created a remote repo, pushed it, and gotten some initial visibility (posting to the 3DTeethSeg/DCBIA-OrthoLab community, r/threejs, Show HN per the earlier discussion), the natural v2 directions are: more patients + a "variation gallery" grouped by malocclusion type, a segmentation-model-predictions-vs-ground-truth visualizer (aimed at the ML research crowd), and only then the AI Q&A layer. None of that is in scope for this document.
