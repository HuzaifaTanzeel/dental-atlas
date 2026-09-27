import { describe, expect, it } from "vitest"
import { fdiTeeth, getFdiTooth } from "./fdi-teeth"

describe("FDI lookup", () => {
  it("names 36 as the lower left first molar", () => {
    expect(getFdiTooth(36)).toEqual({
      fdi: 36,
      name: "Lower left first molar",
      quadrant: 3,
      arch: "lower",
      side: "left",
      type: "molar",
    })
  })

  it("resolves all 32 permanent teeth", () => {
    const numbers = Object.keys(fdiTeeth).map(Number)
    expect(numbers).toHaveLength(32)
    for (const quadrant of [1, 2, 3, 4]) {
      for (let digit = 1; digit <= 8; digit += 1) {
        expect(getFdiTooth(quadrant * 10 + digit).fdi).toBe(quadrant * 10 + digit)
      }
    }
  })

  it("rejects a number that is not an FDI tooth", () => {
    expect(() => getFdiTooth(0)).toThrow(/Unknown FDI number/)
  })
})
