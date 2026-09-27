import { describe, expect, it } from "vitest"
import { getPatientById, patientModelUrl, patients, parsePatients } from "./patients"

describe("patient manifest", () => {
  it("lists 12 patients with unique ids and glb files", () => {
    expect(patients).toHaveLength(12)
    const ids = patients.map((patient) => patient.id)
    expect(new Set(ids).size).toBe(12)
    patients.forEach((patient, index) => {
      const number = String(index + 1).padStart(2, "0")
      expect(patient.id).toBe(`patient-${number}`)
      expect(patient.file).toBe(`patient-${number}.glb`)
      expect(patient.label.startsWith(`Patient ${index + 1}`)).toBe(true)
    })
  })

  it("rejects an entry with an empty label", () => {
    expect(() => parsePatients([{ id: "patient-01", label: "  ", file: "patient-01.glb" }])).toThrow(
      /missing a label/,
    )
  })

  it("rejects an entry without a glb file", () => {
    expect(() => parsePatients([{ id: "patient-01", label: "Patient 1", file: "" }])).toThrow(
      /missing a \.glb file/,
    )
  })

  it("resolves patients by id and model url", () => {
    const first = patients[0]
    expect(first).toBeDefined()
    expect(getPatientById(first!.id)).toBe(first)
    expect(patientModelUrl(first!)).toBe(`/data/${first!.file}`)
    expect(() => getPatientById("missing")).toThrow(/Unknown patient id/)
  })
})
