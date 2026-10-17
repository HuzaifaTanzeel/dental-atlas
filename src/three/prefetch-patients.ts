import { useLoader } from "@react-three/fiber"
import { patients, patientModelUrl, type PatientRecord } from "@/data/patients"
import { PerfGltfLoader } from "@/three/perf-gltf-loader"

const MAX_PREFETCH = 2

/**
 * Warm the GLTF loader cache for the next 1–2 patients in the manifest.
 * At most two URLs are queued; work starts on idle so the active case stays responsive.
 */
export function prefetchNeighborPatients(activeId: string) {
  const index = patients.findIndex((patient) => patient.id === activeId)
  if (index < 0) return () => {}

  const neighbors: PatientRecord[] = []
  for (let offset = 1; offset <= MAX_PREFETCH; offset += 1) {
    const next = patients[index + offset]
    if (next) neighbors.push(next)
  }
  if (neighbors.length === 0) return () => {}

  let cancelled = false
  let idleHandle: number | null = null
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  const run = () => {
    if (cancelled) return
    for (const patient of neighbors) {
      useLoader.preload(PerfGltfLoader, patientModelUrl(patient))
    }
  }

  if (typeof requestIdleCallback === "function") {
    idleHandle = requestIdleCallback(() => run(), { timeout: 1500 })
  } else {
    timeoutHandle = setTimeout(run, 200)
  }

  return () => {
    cancelled = true
    if (idleHandle !== null && typeof cancelIdleCallback === "function") {
      cancelIdleCallback(idleHandle)
    }
    if (timeoutHandle !== null) clearTimeout(timeoutHandle)
  }
}
