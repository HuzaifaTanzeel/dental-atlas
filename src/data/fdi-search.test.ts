import { describe, expect, it } from "vitest"
import { missingToothMessage, searchFdiTeeth } from "./fdi-search"

describe("FDI search", () => {
  it("lists every permanent tooth when the query is empty", () => {
    const results = searchFdiTeeth("  ")
    expect(results).toHaveLength(32)
    expect(results.map((tooth) => tooth.fdi)).toEqual([...results].sort((a, b) => a.fdi - b.fdi).map((tooth) => tooth.fdi))
  })

  it("puts an exact FDI number ahead of looser matches", () => {
    const results = searchFdiTeeth("36")
    expect(results[0]).toMatchObject({ fdi: 36, name: "Lower left first molar" })
    expect(results.every((tooth) => String(tooth.fdi).includes("36") || tooth.name.toLowerCase().includes("36"))).toBe(true)
  })

  it("matches names without caring about case or an FDI prefix", () => {
    expect(searchFdiTeeth("CANINE").map((tooth) => tooth.fdi)).toEqual([13, 23, 33, 43])
    expect(searchFdiTeeth("fdi-23").map((tooth) => tooth.fdi)).toEqual([23])
    expect(searchFdiTeeth("upper left canine")[0]?.fdi).toBe(23)
  })

  it("returns nothing when nothing matches", () => {
    expect(searchFdiTeeth("wisdom extra")).toEqual([])
  })

  it("describes a tooth that is not in the loaded scan", () => {
    const tooth = searchFdiTeeth("23")[0]
    expect(tooth).toBeDefined()
    expect(missingToothMessage(tooth!)).toBe("FDI 23, Upper left canine, is not in this scan.")
  })
})
