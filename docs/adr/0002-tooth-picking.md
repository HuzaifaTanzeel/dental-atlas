# ADR-002: Raycast named tooth meshes, clone enamel per tooth

## Status
Accepted

## Date
2026-09-27

## Context
Phase 3 selects one tooth and shows its FDI number, name, quadrant, and type. Phase 1 already names each tooth mesh `FDI-{number}` and keeps gingiva as `Gingiva-upper` or `Gingiva-lower`. Phase 2 loads the lower arch only and assigns one shared enamel material to every tooth.

human-atlas solves a similar “click a mesh, show a panel” problem for 2,234 structures by merging geometry and writing selection into a GPU texture. This scene has about a dozen visible teeth. React Three Fiber already raycasts meshes that declare pointer events, and `onPointerMissed` on `Canvas` reports clicks that hit nothing.

A drag must orbit, not select. A second finger is a pinch, not a tap. Gingiva is a real mesh, so an empty-space miss does not cover a click on the gum.

## Decision
Pick with React Three Fiber pointer events on the loaded model. The hit mesh name is parsed with `parseFdiNodeName`. `FDI-36` selects 36. Any other name, including gingiva, clears the selection. `Canvas` `onPointerMissed` clears the selection on empty space. Escape and the panel close control do the same.

Each tooth gets its own clone of the enamel material. Hover (mouse only) raises a cool emissive tint and leaves the enamel color. Selection shifts the color toward teal and uses a stronger emissive, so the two states stay distinct. Touch never sets hover.

A small tap gate watches the canvas in the capture phase. Mouse movement past 5px, touch movement past 12px, a second pointer, or a canceled pointer rejects the gesture. Orbit controls still receive the event.

Selection state stays in `ViewerShell`. The detail panel is a non-modal overlay: a right-hand card from 768px up, a bottom sheet on a narrow portrait screen, and a side card in short landscape.

## Alternatives Considered

### GPU selection texture, as in human-atlas
- Pros: One draw call and one highlight path for thousands of parts.
- Cons: This arch is already a handful of meshes. A texture atlas and a custom shader add machinery the scene does not need.
- Rejected: Per-mesh materials are enough and stay on the public Three.js material API.

### Tint the shared enamel material
- Pros: No extra materials.
- Cons: Every tooth would change color together.
- Rejected: Selection has to identify one tooth.

### Treat only `onPointerMissed` as deselect
- Pros: One code path.
- Cons: Gingiva intersects the ray, so a click on the gum never counts as a miss.
- Rejected: Gingiva is handled as a non-tooth hit.

## Consequences
- Hover and selection cannot share one material. New tooth meshes must be named `FDI-{number}` or they will not select.
- Upper teeth are still removed before display, so only the lower arch can be picked until a later phase shows both jaws.
- The tap gate is independent of OrbitControls. If a future control captures the pointer and stops the canvas `pointerup`, selection will stop working and the gate will need to listen on the same element as that control.
