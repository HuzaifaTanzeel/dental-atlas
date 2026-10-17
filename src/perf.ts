/**
 * Load/interaction timing helpers. Active only when the URL has `?perf=1`.
 * Without that query, every export is a no-op or returns false so the app path is unchanged.
 */

export type PerfSnapshot = {
  modelUrl: string | null
  glbFetchMs: number | null
  glbParseMs: number | null
  prepareMs: number | null
  prepareCount: number
  firstFrameMs: number | null
  triangles: number | null
  drawCalls: number | null
  raycastMoveAvgMs: number | null
  raycastMoveSamples: number
}

const emptySnapshot = (): PerfSnapshot => ({
  modelUrl: null,
  glbFetchMs: null,
  glbParseMs: null,
  prepareMs: null,
  prepareCount: 0,
  firstFrameMs: null,
  triangles: null,
  drawCalls: null,
  raycastMoveAvgMs: null,
  raycastMoveSamples: 0,
})

function readPerfFlag(): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URLSearchParams(window.location.search).get("perf") === "1"
  } catch {
    return false
  }
}

export const PERF_ENABLED = readPerfFlag()

let snapshot = emptySnapshot()
let loadEpoch = 0
let loadStartedAt = 0
let firstFrameDone = false
let raycastMoveTotalMs = 0
let raycastMoveSamples = 0
let raycastBucketMs = 0
let raycastBucketScheduled = false

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function patch(partial: Partial<PerfSnapshot>) {
  snapshot = { ...snapshot, ...partial }
  emit()
}

export function isPerfEnabled(): boolean {
  return PERF_ENABLED
}

export function subscribePerf(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPerfSnapshot(): PerfSnapshot {
  return snapshot
}

export function beginPatientLoad(modelUrl: string) {
  if (!PERF_ENABLED) return
  loadEpoch += 1
  loadStartedAt = performance.now()
  firstFrameDone = false
  raycastMoveTotalMs = 0
  raycastMoveSamples = 0
  raycastBucketMs = 0
  raycastBucketScheduled = false
  snapshot = {
    ...emptySnapshot(),
    modelUrl,
  }
  performance.mark("dental-patient-load-start")
  emit()
}

export function markPerf(name: string) {
  if (!PERF_ENABLED) return
  performance.mark(name)
}

export function measurePerf(name: string, startMark: string): number | null {
  if (!PERF_ENABLED) return null
  try {
    performance.measure(name, startMark)
    const entries = performance.getEntriesByName(name, "measure")
    const last = entries[entries.length - 1]
    return last ? last.duration : null
  } catch {
    return null
  }
}

export function recordGlbFetchMs(ms: number) {
  if (!PERF_ENABLED) return
  patch({ glbFetchMs: ms })
}

export function recordGlbParseMs(ms: number) {
  if (!PERF_ENABLED) return
  patch({ glbParseMs: ms })
}

export function recordPrepare(ms: number) {
  if (!PERF_ENABLED) return
  patch({
    prepareMs: ms,
    prepareCount: snapshot.prepareCount + 1,
  })
}

export function recordTriangles(count: number) {
  if (!PERF_ENABLED) return
  patch({ triangles: count })
}

export function recordDrawCalls(count: number) {
  if (!PERF_ENABLED) return
  patch({ drawCalls: count })
}

export function noteFirstFrameIfNeeded(epoch: number) {
  if (!PERF_ENABLED || firstFrameDone || epoch !== loadEpoch) return
  firstFrameDone = true
  const ms = performance.now() - loadStartedAt
  performance.mark("dental-first-frame")
  try {
    performance.measure("dental-time-to-first-frame", "dental-patient-load-start")
  } catch {
    /* start mark missing */
  }
  patch({ firstFrameMs: ms })
}

export function currentLoadEpoch(): number {
  return loadEpoch
}

/** Accumulate Mesh.raycast time; one pointer-move pass is finalized in a microtask. */
export function noteRaycastMs(ms: number) {
  if (!PERF_ENABLED) return
  raycastBucketMs += ms
  if (raycastBucketScheduled) return
  raycastBucketScheduled = true
  queueMicrotask(() => {
    raycastMoveTotalMs += raycastBucketMs
    raycastMoveSamples += 1
    const avg = raycastMoveTotalMs / raycastMoveSamples
    raycastBucketMs = 0
    raycastBucketScheduled = false
    patch({ raycastMoveAvgMs: avg, raycastMoveSamples })
  })
}

export function countTriangles(root: { traverse: (fn: (obj: unknown) => void) => void }): number {
  let triangles = 0
  root.traverse((obj) => {
    const mesh = obj as {
      isMesh?: boolean
      geometry?: { index?: { count: number } | null; attributes?: { position?: { count: number } } }
    }
    if (!mesh.isMesh || !mesh.geometry) return
    const index = mesh.geometry.index
    if (index) {
      triangles += index.count / 3
      return
    }
    const positions = mesh.geometry.attributes?.position
    if (positions) triangles += positions.count / 3
  })
  return Math.round(triangles)
}

export function logPerfTable() {
  if (!PERF_ENABLED) return
  const rows = [
    { metric: "glbFetchMs", value: snapshot.glbFetchMs },
    { metric: "glbParseMs", value: snapshot.glbParseMs },
    { metric: "prepareMs", value: snapshot.prepareMs },
    { metric: "prepareCount", value: snapshot.prepareCount },
    { metric: "firstFrameMs", value: snapshot.firstFrameMs },
    { metric: "triangles", value: snapshot.triangles },
    { metric: "drawCalls", value: snapshot.drawCalls },
    { metric: "raycastMoveAvgMs", value: snapshot.raycastMoveAvgMs },
    { metric: "raycastMoveSamples", value: snapshot.raycastMoveSamples },
    { metric: "modelUrl", value: snapshot.modelUrl },
  ]
  console.table(rows)
}

export function formatPerfOverlay(s: PerfSnapshot): string {
  const n = (v: number | null, digits = 1) => (v === null ? "—" : v.toFixed(digits))
  return [
    "perf=1",
    `fetch ${n(s.glbFetchMs)} ms`,
    `parse ${n(s.glbParseMs)} ms`,
    `prepare ${n(s.prepareMs)} ms ×${s.prepareCount}`,
    `first frame ${n(s.firstFrameMs)} ms`,
    `tris ${s.triangles ?? "—"}`,
    `draws ${s.drawCalls ?? "—"}`,
    `raycast/move ${n(s.raycastMoveAvgMs, 2)} ms (n=${s.raycastMoveSamples})`,
  ].join("\n")
}

if (PERF_ENABLED && typeof window !== "undefined") {
  ;(window as Window & { __dentalPerf?: { getSnapshot: () => PerfSnapshot; logTable: () => void } }).__dentalPerf =
    {
      getSnapshot: getPerfSnapshot,
      logTable: logPerfTable,
    }
}
