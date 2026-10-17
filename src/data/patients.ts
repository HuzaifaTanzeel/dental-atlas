import manifest from "./patients.json" with { type: "json" }

export type ToothCountByArch = {
  upper: number
  lower: number
}

export type PatientRecord = {
  id: string
  label: string
  file: string
  /** Neutral display name, e.g. "Case 12". */
  title?: string
  /** One-line clinical summary, e.g. "Missing: 36, 46". */
  summary?: string
  presentFdi?: number[]
  missingFdi?: number[]
  toothCount?: ToothCountByArch
  hasThirdMolars?: boolean
  bytes?: number
  triangleCount?: number
  tags?: string[]
}

function optionalNumberArray(value: unknown, field: string, index: number): number[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
    throw new Error(`Patient entry ${index} has an invalid ${field} array`)
  }
  return value as number[]
}

function optionalToothCount(value: unknown, index: number): ToothCountByArch | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== "object") {
    throw new Error(`Patient entry ${index} has an invalid toothCount`)
  }
  const record = value as Record<string, unknown>
  if (typeof record.upper !== "number" || typeof record.lower !== "number") {
    throw new Error(`Patient entry ${index} has an invalid toothCount`)
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
    const presentFdi = optionalNumberArray(record.presentFdi, "presentFdi", index)
    const missingFdi = optionalNumberArray(record.missingFdi, "missingFdi", index)
    const toothCount = optionalToothCount(record.toothCount, index)
    const hasThirdMolars = optionalBoolean(record.hasThirdMolars, "hasThirdMolars", index)
    const bytes = optionalFiniteNumber(record.bytes, "bytes", index)
    const triangleCount = optionalFiniteNumber(record.triangleCount, "triangleCount", index)
    const tags = optionalStringArray(record.tags, "tags", index)

    if (title !== undefined) parsed.title = title
    if (summary !== undefined) parsed.summary = summary
    if (presentFdi !== undefined) parsed.presentFdi = presentFdi
    if (missingFdi !== undefined) parsed.missingFdi = missingFdi
    if (toothCount !== undefined) parsed.toothCount = toothCount
    if (hasThirdMolars !== undefined) parsed.hasThirdMolars = hasThirdMolars
    if (bytes !== undefined) parsed.bytes = bytes
    if (triangleCount !== undefined) parsed.triangleCount = triangleCount
    if (tags !== undefined) parsed.tags = tags
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
