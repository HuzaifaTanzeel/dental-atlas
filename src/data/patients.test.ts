import { describe, expect, it } from "vitest"
import {
  getPatientById,
  patientArches,
  patientDisplayName,
  patientHasArch,
  patientModelUrl,
  patients,
  parsePatients,
} from "./patients"

describe("patient manifest", () => {
  it("lists patients with unique ids and glb files", () => {
    expect(patients.length).toBeGreaterThan(0)
    const ids = patients.map((patient) => patient.id)
    expect(new Set(ids).size).toBe(patients.length)
    patients.forEach((patient) => {
      expect(patient.id).toMatch(/^patient-\d+$/)
      expect(patient.file).toBe(`${patient.id}.glb`)
      expect(patient.label.trim().length).toBeGreaterThan(0)
      const arches = patientArches(patient)
      expect(arches.length).toBeGreaterThan(0)
      for (const arch of arches) {
        expect(patientHasArch(patient, arch)).toBe(true)
      }
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
      const arches = patientArches(first!)
      const expectedSlots = arches.includes("upper") && arches.includes("lower") ? 32 : 16
      expect(first!.presentFdi.length + first!.missingFdi.length).toBe(expectedSlots)
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
        arches: ["lower"],
        presentFdi: [31, 32],
        missingFdi: [36],
        toothCount: { upper: 0, lower: 2 },
        instanceCount: { upper: 0, lower: 2 },
        hasThirdMolars: false,
        bytes: 100,
        triangleCount: 50,
        tags: ["single-missing", "posterior-missing", "lower-only"],
        jawMeta: {
          lower: { vertexCount: 10, faceCount: 12, instanceCount: 2, presentFdi: [31, 32] },
        },
        landmarks: {
          lower: {
            file: "landmarks/patient-01-lower.json",
            landmarkCount: 4,
            counts: { Cusp: 2, Mesial: 1, Distal: 1 },
            split: "train",
          },
        },
        challengeSplit: { lower: "train" },
      },
    ])
    expect(parsed[0]).toMatchObject({
      title: "Case 1",
      summary: "Missing: 36",
      hasThirdMolars: false,
      arches: ["lower"],
      tags: ["single-missing", "posterior-missing", "lower-only"],
    })
    expect(patientArches(parsed[0]!)).toEqual(["lower"])
    expect(patientHasArch(parsed[0]!, "upper")).toBe(false)
  })

  it("resolves patients by id and model url", () => {
    const first = patients[0]
    expect(first).toBeDefined()
    expect(getPatientById(first!.id)).toBe(first)
    expect(patientModelUrl(first!)).toBe(`/data/${first!.file}`)
    expect(() => getPatientById("missing")).toThrow(/Unknown patient id/)
  })
})
