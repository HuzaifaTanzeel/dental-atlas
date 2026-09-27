import { describe, expect, it } from "vitest"
import { PointerTap, tapThreshold } from "./pointer-tap"

describe("PointerTap", () => {
  it("accepts a mouse press that stays inside 5px", () => {
    const tap = new PointerTap()
    tap.down(1, 10, 10, tapThreshold("mouse"))
    tap.move(1, 14, 12)
    expect(tap.up(1, 14, 12)).toBe(true)
  })

  it("rejects a mouse drag past 5px", () => {
    const tap = new PointerTap()
    tap.down(1, 0, 0, tapThreshold("mouse"))
    expect(tap.up(1, 6, 0)).toBe(false)
  })

  it("gives touch a wider 12px threshold", () => {
    const tap = new PointerTap()
    tap.down(1, 0, 0, tapThreshold("touch"))
    expect(tap.up(1, 12, 0)).toBe(true)

    tap.down(1, 0, 0, tapThreshold("touch"))
    expect(tap.up(1, 13, 0)).toBe(false)
  })

  it("rejects a second pointer so a pinch cannot select", () => {
    const tap = new PointerTap()
    tap.down(1, 0, 0, 12)
    tap.down(2, 40, 40, 12)
    expect(tap.up(1, 0, 0)).toBe(false)
    expect(tap.up(2, 40, 40)).toBe(false)
  })

  it("rejects a canceled pointer and allows the next tap", () => {
    const tap = new PointerTap()
    tap.down(1, 0, 0, 5)
    tap.cancel(1)
    expect(tap.up(1, 0, 0)).toBe(false)

    tap.down(1, 0, 0, 5)
    expect(tap.up(1, 1, 1)).toBe(true)
  })
})
