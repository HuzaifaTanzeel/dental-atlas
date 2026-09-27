# Phase 3 tasks

## Task 1: Parse FDI node names

**Description:** Map a glTF node name to an FDI number, or null when the node is gingiva or not a tooth.

**Acceptance criteria:**
- [x] `FDI-36` returns `36`
- [x] `Gingiva-lower`, `Gingiva-upper`, and unknown names return `null`
- [x] `getFdiTooth` is not called for a null parse

**Verification:**
- [x] Tests pass: `npm test`
- [x] Type check passes: `npm run check`

**Dependencies:** None

**Files likely touched:**
- `src/data/fdi-teeth.ts`
- `src/data/fdi-teeth.test.ts`

**Estimated scope:** Small

## Task 2: Pick and highlight teeth

**Description:** Raycast the loaded tooth meshes, ignore orbit drags and pinches, and tint hover and selection differently.

**Acceptance criteria:**
- [x] A short click or tap on `FDI-*` selects that number
- [x] A drag, a second pointer, gingiva, and empty space do not select
- [x] Hover and selected materials are different, and selected wins when both apply
- [x] Touch does not leave a hover tint

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: click, hover, drag, and miss in the viewer

**Dependencies:** Task 1

**Files likely touched:**
- `src/three/pointer-tap.ts`
- `src/three/PatientModel.tsx`
- `src/three/DentalScene.tsx`

**Estimated scope:** Medium

## Task 3: FDI detail panel

**Description:** Show the selected tooth's FDI number, name, quadrant, and type, and clear it from empty space, gingiva, Escape, or the close control. The panel sits on the right on desktop and along the bottom on a phone.

**Acceptance criteria:**
- [x] Panel copy matches `getFdiTooth`
- [x] Escape, close, gingiva, and empty space clear selection and highlight
- [x] Desktop, phone portrait, and phone landscape layouts do not cover the whole arch
- [x] Footer hint mentions selecting a tooth

**Verification:**
- [x] Manual check at desktop and 390px widths
- [x] Keyboard: Escape clears; close control is focusable

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/ViewerShell.tsx`
- `src/components/ToothDetailPanel.tsx`

**Estimated scope:** Medium

## Task 4: Record the picking decision

**Description:** Write ADR-002 explaining R3F events and cloned materials instead of a GPU selection atlas.

**Acceptance criteria:**
- [x] ADR matches the existing heading set in `docs/adr/0001-patient-glb-layout.md`

**Verification:**
- [x] File exists at `docs/adr/0002-tooth-picking.md`

**Dependencies:** Tasks 1–3

**Files likely touched:**
- `docs/adr/0002-tooth-picking.md`

**Estimated scope:** Small

## Checkpoint: After Tasks 1–4
- [x] `npm test`, `npm run check`, `npm run lint`, and `npm run build` pass
- [x] Every visible lower tooth on patient-01 selects with the correct FDI info on mouse and touch
- [x] Hover and selected states differ; deselect works; console stays clean
- [ ] Code review, merge to `main` with `--no-ff`, tag `v0.1-phase3`, no push
