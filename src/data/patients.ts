import manifest from "./patients.json" with { type: "json" }

export type ToothCountByArch = {
  upper: number
  lower: number
}

export type ArchId = "upper" | "lower"

export type LandmarkClassCounts = Record<string, number>

export type PatientLandmarkArch = {
  file: string
  landmarkCount: number
  counts: LandmarkClassCounts
  split?: string
}

export type PatientJawMeta = {
  vertexCount: number
  faceCount: number | null
  instanceCount: number
  presentFdi: number[]
}

export type PatientRecord = {
  id: string
  label: string
  file: string
  /** Neutral display name, e.g. "Case 12". */
  title?: string
  /** One-line clinical summary, e.g. "Missing: 36, 46". */
  summary?: string
  /** Which jaws are present in the GLB. */
  arches?: ArchId[]
  presentFdi?: number[]
  missingFdi?: number[]
  toothCount?: ToothCountByArch
  instanceCount?: ToothCountByArch
  hasThirdMolars?: boolean
  bytes?: number
  triangleCount?: number
  tags?: string[]
  jawMeta?: Partial<Record<ArchId, PatientJawMeta>>
  landmarks?: Partial<Record<ArchId, PatientLandmarkArch>>
  challengeSplit?: Partial<Record<ArchId, string>>
}

function optionalNumberArray(value: unknown, field: string, index: number): number[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
    throw new Error(`Patient entry ${index} has an invalid ${field} array`)
  }
  return value as number[]
}

function optionalToothCount(value: unknown, field: string, index: number): ToothCountByArch | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== "object") {
    throw new Error(`Patient entry ${index} has an invalid ${field}`)
  }
  const record = value as Record<string, unknown>
  if (typeof record.upper !== "number" || typeof record.lower !== "number") {
    throw new Error(`Patient entry ${index} has an invalid ${field}`)
  }
  return { upper: record.upper, lower: record.lower }
}

function optionalStringArray(value: unknown, field: string, index: number): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Patient entry ${index} has an invalid ${field} array`)
  }
  return value as string[]
}

function optionalBoolean(value: unknown, field: string, index: number): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "boolean") {
    throw new Error(`Patient entry ${index} has an invalid ${field}`)
  }
  return value
}

function optionalFiniteNumber(value: unknown, field: string, index: number): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Patient entry ${index} has an invalid ${field}`)
  }
  return value
}

function optionalNonEmptyString(value: unknown, field: string, index: number): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Patient entry ${index} has an invalid ${field}`)
  }
  return value
}

function optionalArches(value: unknown, index: number): ArchId[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Patient entry ${index} has an invalid arches array`)
  }
  const arches: ArchId[] = []
  for (const entry of value) {
    if (entry !== "upper" && entry !== "lower") {
      throw new Error(`Patient entry ${index} has an invalid arch id`)
    }
    if (!arches.includes(entry)) arches.push(entry)
  }
  return arches
}

function optionalLandmarkCounts(value: unknown, index: number): LandmarkClassCounts | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== "object") {
    throw new Error(`Patient entry ${index} has invalid landmark counts`)
  }
  const counts: LandmarkClassCounts = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      throw new Error(`Patient entry ${index} has invalid landmark count for ${key}`)
    }
    counts[key] = entry
  }
  return counts
}

function optionalLandmarks(
  value: unknown,
  index: number,
): Partial<Record<ArchId, PatientLandmarkArch>> | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== "object") {
    throw new Error(`Patient entry ${index} has invalid landmarks`)
  }
  const result: Partial<Record<ArchId, PatientLandmarkArch>> = {}
  for (const arch of ["upper", "lower"] as const) {
    const entry = (value as Record<string, unknown>)[arch]
    if (entry === undefined) continue
    if (entry === null || typeof entry !== "object") {
      throw new Error(`Patient entry ${index} has invalid landmarks.${arch}`)
    }
    const record = entry as Record<string, unknown>
    const file = optionalNonEmptyString(record.file, `landmarks.${arch}.file`, index)
    const landmarkCount = optionalFiniteNumber(record.landmarkCount, `landmarks.${arch}.landmarkCount`, index)
    const counts = optionalLandmarkCounts(record.counts, index)
    if (!file || landmarkCount === undefined || !counts) {
      throw new Error(`Patient entry ${index} has incomplete landmarks.${arch}`)
    }
    const split = optionalNonEmptyString(record.split, `landmarks.${arch}.split`, index)
    result[arch] = { file, landmarkCount, counts, ...(split ? { split } : {}) }
  }
  return result
}

function optionalJawMeta(
  value: unknown,
  index: number,
): Partial<Record<ArchId, PatientJawMeta>> | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== "object") {
    throw new Error(`Patient entry ${index} has invalid jawMeta`)
  }
  const result: Partial<Record<ArchId, PatientJawMeta>> = {}
  for (const arch of ["upper", "lower"] as const) {
    const entry = (value as Record<string, unknown>)[arch]
    if (entry === undefined) continue
    if (entry === null || typeof entry !== "object") {
      throw new Error(`Patient entry ${index} has invalid jawMeta.${arch}`)
    }
    const record = entry as Record<string, unknown>
    const vertexCount = optionalFiniteNumber(record.vertexCount, `jawMeta.${arch}.vertexCount`, index)
    const instanceCount = optionalFiniteNumber(record.instanceCount, `jawMeta.${arch}.instanceCount`, index)
    const presentFdi = optionalNumberArray(record.presentFdi, `jawMeta.${arch}.presentFdi`, index)
    if (vertexCount === undefined || instanceCount === undefined || presentFdi === undefined) {
      throw new Error(`Patient entry ${index} has incomplete jawMeta.${arch}`)
    }
    const faceCount =
      record.faceCount === null || record.faceCount === undefined
        ? null
        : optionalFiniteNumber(record.faceCount, `jawMeta.${arch}.faceCount`, index) ?? null
    result[arch] = { vertexCount, faceCount, instanceCount, presentFdi }
  }
  return result
}

function optionalChallengeSplit(
  value: unknown,
  index: number,
): Partial<Record<ArchId, string>> | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== "object") {
    throw new Error(`Patient entry ${index} has invalid challengeSplit`)
  }
  const result: Partial<Record<ArchId, string>> = {}
  for (const arch of ["upper", "lower"] as const) {
    const entry = (value as Record<string, unknown>)[arch]
    if (entry === undefined) continue
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`Patient entry ${index} has invalid challengeSplit.${arch}`)
    }
    result[arch] = entry
  }
  return result
}

export function parsePatients(value: unknown): PatientRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("Patient manifest must be an array")
  }

  const ids = new Set<string>()
  return value.map((item, index) => {
    if (item === null || typeof item !== "object") {
      throw new Error(`Patient entry ${index} must be an object`)
    }
    const record = item as Record<string, unknown>
    if ("sourceId" in record) {
      throw new Error(`Patient entry ${index} must not include sourceId`)
    }
    const { id, label, file } = record
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Patient entry ${index} is missing an id`)
    }
    if (typeof label !== "string" || label.trim().length === 0) {
      throw new Error(`Patient entry ${index} is missing a label`)
    }
    if (typeof file !== "string" || !file.endsWith(".glb")) {
      throw new Error(`Patient entry ${index} is missing a .glb file`)
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate patient id: ${id}`)
    }
    ids.add(id)

    const parsed: PatientRecord = { id, label, file }
    const title = optionalNonEmptyString(record.title, "title", index)
    const summary = optionalNonEmptyString(record.summary, "summary", index)
    const arches = optionalArches(record.arches, index)
    const presentFdi = optionalNumberArray(record.presentFdi, "presentFdi", index)
    const missingFdi = optionalNumberArray(record.missingFdi, "missingFdi", index)
    const toothCount = optionalToothCount(record.toothCount, "toothCount", index)
    const instanceCount = optionalToothCount(record.instanceCount, "instanceCount", index)
    const hasThirdMolars = optionalBoolean(record.hasThirdMolars, "hasThirdMolars", index)
    const bytes = optionalFiniteNumber(record.bytes, "bytes", index)
    const triangleCount = optionalFiniteNumber(record.triangleCount, "triangleCount", index)
    const tags = optionalStringArray(record.tags, "tags", index)
    const jawMeta = optionalJawMeta(record.jawMeta, index)
    const landmarks = optionalLandmarks(record.landmarks, index)
    const challengeSplit = optionalChallengeSplit(record.challengeSplit, index)

    if (title !== undefined) parsed.title = title
    if (summary !== undefined) parsed.summary = summary
    if (arches !== undefined) parsed.arches = arches
    if (presentFdi !== undefined) parsed.presentFdi = presentFdi
    if (missingFdi !== undefined) parsed.missingFdi = missingFdi
    if (toothCount !== undefined) parsed.toothCount = toothCount
    if (instanceCount !== undefined) parsed.instanceCount = instanceCount
    if (hasThirdMolars !== undefined) parsed.hasThirdMolars = hasThirdMolars
    if (bytes !== undefined) parsed.bytes = bytes
    if (triangleCount !== undefined) parsed.triangleCount = triangleCount
    if (tags !== undefined) parsed.tags = tags
    if (jawMeta !== undefined) parsed.jawMeta = jawMeta
    if (landmarks !== undefined) parsed.landmarks = landmarks
    if (challengeSplit !== undefined) parsed.challengeSplit = challengeSplit
    return parsed
  })
}

export const patients: PatientRecord[] = parsePatients(manifest)

export function getPatientById(id: string): PatientRecord {
  const patient = patients.find((entry) => entry.id === id)
  if (!patient) {
    throw new Error(`Unknown patient id: ${id}`)
  }
  return patient
}

export function patientModelUrl(patient: PatientRecord): string {
  return `/data/${patient.file}`
}

/** Prefer neutral Case N title when present; otherwise the legacy label. */
export function patientDisplayName(patient: PatientRecord): string {
  return patient.title?.trim() || patient.label
}

/** Jaws available for a patient — defaults to both when the field is absent. */
export function patientArches(patient: PatientRecord): ArchId[] {
  if (patient.arches && patient.arches.length > 0) return patient.arches
  return ["upper", "lower"]
}

export function patientHasArch(patient: PatientRecord, arch: ArchId): boolean {
  return patientArches(patient).includes(arch)
}
