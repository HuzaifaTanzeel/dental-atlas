# Implementation Plan: Phase 3 tooth selection

## Overview

Click or tap a named tooth mesh in the loaded lower arch and show its FDI number, common name, quadrant, and type. Hover and selected highlights stay visually distinct. Empty space, gingiva, and Escape clear the selection. Work stays on `phase-3-tooth-selection` and merges to `main` as `v0.1-phase3` with no remote push.

## Architecture Decisions

- Raycast with React Three Fiber pointer events on the loaded `FDI-*` meshes. Human-atlas GPU selection textures are for thousands of merged parts and are not used here.
- Clone the enamel material per tooth so a tint does not recolor the whole arch. Gingiva keeps the shared material and is treated as a miss.
- A small tap gate (5px mouse, 12px touch, block a second pointer) separates a selection from orbit and pinch. Hover is mouse-only.
- Selection state lives in `ViewerShell`. The detail panel is a custom overlay: right card on desktop, bottom sheet on phones, side card in phone landscape.
- `parseFdiNodeName` turns `FDI-36` into `36` and rejects gingiva and junk before `getFdiTooth` is called.

## Task List

### Slice 1: FDI node names
- [x] Task 1: `parseFdiNodeName` and unit tests

### Slice 2: Picking and highlight
- [x] Task 2: Tap gate, per-tooth materials, hover and select tints

### Slice 3: Detail panel
- [x] Task 3: Shell state, Escape, responsive panel, footer hint

### Slice 4: Decision record
- [x] Task 4: ADR-002 for the picking approach

### Checkpoint: Verify, review, ship
- [x] Tests, typecheck, lint, and build pass
- [x] Every visible lower tooth selects with the right FDI info on mouse and touch
- [ ] Self-review, `--no-ff` merge to `main`, tag `v0.1-phase3`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shared enamel material tints every tooth | High | Clone the material once per tooth mesh |
| Orbit drag or pinch selects a tooth | High | Tap gate with movement and multitouch blocking |
| Gingiva hits do not fire `onPointerMissed` | Medium | Treat any non-`FDI-*` hit as deselect |
| Occlusal teeth are hard to hit from the front view | Medium | Orbit during verification and retry |

## Open Questions

None. The approved plan fixed the panel style, the picking method, and deselect behavior.
