# Perf baseline — patient GLB load and hover cost

Measured with `?perf=1` (overlay + `console.table` / `window.__dentalPerf.getSnapshot()`).  
Machine: local Windows host; assets served from the same machine (`127.0.0.1`).  
Date: 2026-10-17.

**Network time is negligible for ranking.** Files are local. “Fetch” here is localhost disk/HTTP transfer of the GLB, not a remote CDN. In every run below, fetch is far smaller than `preparePatientModel` (clone + `smoothForDisplay` / `mergeVertices` + normals).

## Files under test

| Patient | File | On-disk size |
| --- | --- | ---: |
| Smallest | `public/data/patient-02.glb` | 6.95 MB (7,286,804 bytes) |
| Largest | `public/data/patient-05.glb` | 9.73 MB (10,201,880 bytes) |

Default first load is patient-01; numbers below are from switching the patient picker to 02 / 05 after the app shell was already up (cold GLB for that patient, warm JS).

## How to reproduce

```bash
npm run dev
# open http://127.0.0.1:5173/?perf=1
# switch patient, hover the scan, read overlay or window.__dentalPerf.getSnapshot()

npm run build && npm run preview -- --host 127.0.0.1 --port 4173
# open http://127.0.0.1:4173/?perf=1
```

Without `?perf=1` the overlay and marks are off; production path is unchanged.

## `npm run dev` (Vite + React `StrictMode`)

| Metric | patient-02 (small) | patient-05 (large) |
| --- | ---: | ---: |
| glbFetchMs | 132 | 185 |
| glbParseMs | 31 | 39 |
| prepareMs | 1927 | 3514 |
| prepareCount | **2** | **2** |
| firstFrameMs | 4591 | 7332 |
| triangles | 399 030 | 560 026 |
| drawCalls | 17 | 17 |
| raycastMoveAvgMs (n=12) | 31.1 | 44.9 |

**StrictMode:** `prepareCount` is **2** in dev. `main.tsx` wraps the app in `<StrictMode>`, so prepare (including `smoothForDisplay`) runs twice per load in development. Preview shows `prepareCount: 1`.

## `npm run build && npm run preview`

| Metric | patient-02 (small) | patient-05 (large) |
| --- | ---: | ---: |
| glbFetchMs | 26 | 52 |
| glbParseMs | 8 | 14 |
| prepareMs | 1111 | 1739 |
| prepareCount | **1** | **1** |
| firstFrameMs | 1200 | 1881 |
| triangles | 399 030 | 560 026 |
| drawCalls | 17 | 17 |
| raycastMoveAvgMs (n=12) | 20.6 | 15.3 |

Raycast averages come from synthetic `pointermove` events over the canvas; treat them as order-of-magnitude interaction cost, not a lab-grade hover path.

## Top 3 bottlenecks (with evidence)

1. **`preparePatientModel` / `smoothForDisplay` (dominant)**  
   Preview: 1111–1739 ms per patient. Dev: 1927–3514 ms *and* doubled by StrictMode. That is most of `firstFrameMs`. Work is clone + per-mesh `mergeVertices` + `computeVertexNormals` for display lighting. License-safe: disk GLB stays lossless; smoothing is runtime-only.

2. **Time to first rendered frame (follows prepare)**  
   Preview first frame ≈ 1.2–1.9 s after patient switch; dev ≈ 4.6–7.3 s. Fetch + parse together are tens of milliseconds in preview and under ~225 ms in dev — not the gate.

3. **Hover raycast cost while moving the pointer**  
   ~15–45 ms averaged per pointer-move raycast pass (all mesh `raycast` calls in that move). Enough to feel sticky on dense arches; secondary to load, primary for continuous hover lag.

**Not in the top 3:** localhost GLB fetch; GLB parse; draw-call count (~17 — well under the anatomy spike’s later budget concerns).

## Notes

- Triangle counts are after display welding in prepare (clone), not a claim about on-disk vertex counts.
- `drawCalls` is `renderer.info.render.calls` sampled after the model is ready.
- Dev first-frame times include StrictMode’s extra prepare; do not compare raw `prepareMs` × `prepareCount` to preview without saying so.
