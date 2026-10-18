import { describe, expect, it } from "vitest"
import {
  caseSearchText,
  caseTitle,
  emptyCaseLibraryFilters,
  filterCases,
  normalizeSearchQuery,
  parseTagsParam,
  serializeTagsParam,
  tagChipsFromPatients,
  toggleTag,
} from "./case-library"
import type { PatientRecord } from "./patients"

const sample: PatientRecord[] = [
  {
    id: "patient-01",
    label: "Patient 1 — third molars absent",
    title: "Case 1",
    summary: "Missing: 18, 28, 38, 48",
    file: "patient-01.glb",
    tags: ["multiple-missing", "posterior-missing", "third-molars-absent"],
  },
  {
    id: "patient-07",
    label: "Patient 7 — several missing teeth",
    title: "Case 7",
    summary: "Missing: 46, 47",
    file: "patient-07.glb",
    missingFdi: [46, 47],
    tags: ["multiple-missing", "posterior-missing"],
  },
  {
    id: "patient-03",
    label: "Patient 3 — upper left canine absent",
    title: "Case 3",
    summary: "Missing: 23",
    file: "patient-03.glb",
    tags: ["single-missing", "anterior-missing"],
  },
]

describe("case library filters", () => {
  it("builds tag chips with counts", () => {
    const chips = tagChipsFromPatients(sample)
    expect(chips.find((chip) => chip.tag === "posterior-missing")).toMatchObject({ count: 2 })
    expect(chips.find((chip) => chip.tag === "anterior-missing")).toMatchObject({ count: 1 })
  })

  it("filters by tags with AND semantics", () => {
    const filtered = filterCases(sample, {
      tags: ["posterior-missing", "third-molars-absent"],
      query: "",
    })
    expect(filtered.map((entry) => entry.id)).toEqual(["patient-01"])
  })

  it("finds a lower molar case from free text", () => {
    const filtered = filterCases(sample, {
      ...emptyCaseLibraryFilters(),
      query: "lower molar",
    })
    expect(filtered.map((entry) => entry.id)).toEqual(["patient-07"])
  })

  it("matches FDI numbers in the summary", () => {
    const filtered = filterCases(sample, { tags: [], query: "46" })
    expect(filtered.map((entry) => entry.id)).toEqual(["patient-07"])
  })

  it("clears filters to the full list", () => {
    expect(filterCases(sample, emptyCaseLibraryFilters())).toHaveLength(3)
  })

  it("toggles tags and serializes query params", () => {
    expect(toggleTag(["a"], "b")).toEqual(["a", "b"])
    expect(toggleTag(["a", "b"], "a")).toEqual(["b"])
    expect(parseTagsParam("posterior-missing,single-missing")).toEqual([
      "posterior-missing",
      "single-missing",
    ])
    expect(serializeTagsParam(["a", "b"])).toBe("a,b")
    expect(normalizeSearchQuery("  Lower   Molar ")).toBe("lower molar")
  })

  it("prefers Case titles", () => {
    expect(caseTitle(sample[0]!)).toBe("Case 1")
    expect(caseSearchText(sample[0]!)).toContain("missing: 18, 28, 38, 48")
  })
})
