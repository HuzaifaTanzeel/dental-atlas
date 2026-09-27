import manifest from "./patients.json" with { type: "json" }

export type PatientRecord = {
  id: string
  label: string
  file: string
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
    return { id, label, file }
  })
}

export const patients: PatientRecord[] = parsePatients(manifest)
