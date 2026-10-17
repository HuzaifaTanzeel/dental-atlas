import { describe, expect, it } from "vitest"
import {
  getPatientById,
  patientDisplayName,
  patientModelUrl,
  patients,
  parsePatients,
} from "./patients"

describe("patient manifest", () => {
  it("lists 12 patients with unique ids and glb files", () => {
    expect(patients).toHaveLength(12)
    const ids = patients.map((patient) => patient.id)
    expect(new Set(ids).size).toBe(12)
    patients.forEach((patient, index) => {
      const number = String(index + 1).padStart(2, "0")
      expect(patient.id).toBe(`patient-${number}`)
      expect(patient.file).toBe(`patient-${number}.glb`)
      expect(patient.label.trim().length).toBeGreaterThan(0)
    })
  })

  it("keeps legacy labels working and accepts optional enrichment fields", () => {
    const first = patients[0]
    expect(first).toBeDefined()
    expect(first!.label.length).toBeGreaterThan(0)
    if (first!.title) {
      expect(first!.title.startsWith("Case ")).toBe(true)
      expect(patientDisplayName(first!)).toBe(first!.title)
    } else {
      expect(patientDisplayName(first!)).toBe(first!.label)
    }
    if (first!.presentFdi && first!.missingFdi && first!.toothCount) {
      expect(first!.presentFdi.length + first!.missingFdi.length).toBe(32)
      expect(first!.toothCount.upper + first!.toothCount.lower).toBe(first!.presentFdi.length)
    }
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

  it("rejects sourceId in the public manifest", () => {
    expect(() =>
      parsePatients([{ id: "patient-01", label: "Patient 1", file: "patient-01.glb", sourceId: "ABC" }]),
    ).toThrow(/must not include sourceId/)
  })

  it("parses optional fields when present", () => {
    const parsed = parsePatients([
      {
        id: "patient-01",
        label: "Patient 1 — demo",
        title: "Case 1",
        summary: "Missing: 36",
        file: "patient-01.glb",
        presentFdi: [11, 21],
        missingFdi: [36],
        toothCount: { upper: 2, lower: 0 },
        hasThirdMolars: false,
        bytes: 100,
        triangleCount: 50,
        tags: ["single-missing", "posterior-missing"],
      },
    ])
    expect(parsed[0]).toMatchObject({
      title: "Case 1",
      summary: "Missing: 36",
      hasThirdMolars: false,
      tags: ["single-missing", "posterior-missing"],
    })
  })

  it("resolves patients by id and model url", () => {
    const first = patients[0]
    expect(first).toBeDefined()
    expect(getPatientById(first!.id)).toBe(first)
    expect(patientModelUrl(first!)).toBe(`/data/${first!.file}`)
    expect(() => getPatientById("missing")).toThrow(/Unknown patient id/)
  })
})
