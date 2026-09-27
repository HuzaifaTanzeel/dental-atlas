import { describe, expect, it } from "vitest"
import {
  archDisplay,
  cameraFocusFilter,
  displayedModelPoint,
  modelPointToWorld,
  pieceVisible,
  studioPose,
  type ModelPiece,
} from "./model-space"

const molar: ModelPiece = {
  fdi: 36,
  arch: "lower",
  kind: "molar",
  center: [0, 0, 0],
  half: [1, 1, 1],
}

describe("scanner axis mapping", () => {
  it("stands the scan upright and turns the front toward the camera", () => {
    const up = modelPointToWorld([0, 0, 1])
    const anterior = modelPointToWorld([0, -1, 0])
    expect(up.toArray()).toEqual([expect.closeTo(0), expect.closeTo(1), expect.closeTo(0)])
    expect(anterior.toArray()).toEqual([expect.closeTo(0), expect.closeTo(0), expect.closeTo(1)])
  })
})

const upperMolar: ModelPiece = {
  fdi: 16,
  arch: "upper",
  kind: "molar",
  center: [0, 0, 0],
  half: [10, 10, 5],
}

describe("arch display", () => {
  it("leaves the lower arch where the scan placed it", () => {
    const display = archDisplay([molar, upperMolar], ["lower"])
    expect(display.lower).toEqual({ offset: [0, 0, 0], mirrorZ: false, pivotZ: 0 })
    expect(display.upper.mirrorZ).toBe(false)
  })

  it("turns the upper arch so its crowns point down", () => {
    const display = archDisplay([molar, upperMolar], ["upper"])
    expect(display.upper.mirrorZ).toBe(true)
    expect(display.upper.offset).toEqual([0, 0, 0])
    const crown = displayedModelPoint([0, 0, 4], display.upper)[2]
    const root = displayedModelPoint([0, 0, -4], display.upper)[2]
    expect(crown).toBeLessThan(root)
  })

  it("places the inverted upper arch above the lower arch in occlusion", () => {
    const display = archDisplay([molar, upperMolar], ["upper", "lower"])
    expect(display.lower.offset).toEqual([0, 0, 0])
    expect(display.upper.mirrorZ).toBe(true)

    const lowerCrown = displayedModelPoint([0, 0, molar.half[2]], display.lower)[2]
    const upperCrown = displayedModelPoint([0, 0, upperMolar.half[2]], display.upper)[2]
    const upperRoot = displayedModelPoint([0, 0, -upperMolar.half[2]], display.upper)[2]
    expect(upperCrown).toBeGreaterThan(lowerCrown)
    expect(upperRoot).toBeGreaterThan(upperCrown)
  })

  it("sets the stage above the upper arch and below the lower arch", () => {
    const filter = {
      layers: ["molar"] as const,
      gingiva: false,
      isolate: false,
      selectedFdi: null,
    }
    const upper = studioPose([molar, upperMolar], { ...filter, arches: ["upper"] }, "front", 0, 34)
    const lower = studioPose([molar, upperMolar], { ...filter, arches: ["lower"] }, "front", 0, 34)
    expect(upper?.stageAbove).toBe(true)
    expect(lower?.stageAbove).toBe(false)
    expect(upper!.stageCenter.y).toBeGreaterThan(0)
    expect(lower!.stageCenter.y).toBeLessThan(0)
  })
})

describe("camera focus", () => {
  const filter = {
    arches: ["lower"] as const,
    layers: ["molar"] as const,
    gingiva: true,
    isolate: false,
    selectedFdi: null,
  }
  const left: ModelPiece = { ...molar, center: [20, -10, 4], half: [2, 2, 2] }
  const right: ModelPiece = { ...molar, fdi: 46, center: [-24, -8, 3], half: [2, 2, 2] }

  it("frames the requested tooth when that tooth is in view", () => {
    const focused = cameraFocusFilter(filter, 46, [left, right])
    const pose = studioPose([left, right], focused, "front", 0, 34)
    const world = modelPointToWorld(right.center)
    expect(focused.isolate).toBe(true)
    expect(focused.selectedFdi).toBe(46)
    expect(pose?.target.x).toBeCloseTo(world.x)
    expect(pose?.target.y).toBeCloseTo(world.y)
    expect(pose?.target.z).toBeCloseTo(world.z)
  })

  it("leaves the current framing when the tooth is missing or on a hidden arch", () => {
    expect(cameraFocusFilter(filter, null, [left])).toBe(filter)
    expect(cameraFocusFilter(filter, 23, [left])).toBe(filter)
    expect(cameraFocusFilter({ ...filter, arches: ["upper"] }, 36, [left])).toEqual({
      ...filter,
      arches: ["upper"],
    })
  })
})

describe("piece visibility", () => {
  it("hides a tooth whose layer or arch is off", () => {
    expect(
      pieceVisible(molar, {
        arches: ["lower"],
        layers: ["incisor"],
        gingiva: true,
        isolate: false,
        selectedFdi: null,
      }),
    ).toBe(false)
    expect(
      pieceVisible(molar, {
        arches: ["upper"],
        layers: ["molar"],
        gingiva: true,
        isolate: false,
        selectedFdi: null,
      }),
    ).toBe(false)
  })

  it("keeps only the selected tooth while isolating", () => {
    const filter = {
      arches: ["upper", "lower"] as const,
      layers: ["molar"] as const,
      gingiva: true,
      isolate: true,
      selectedFdi: 36,
    }
    expect(pieceVisible(molar, filter)).toBe(true)
    expect(pieceVisible({ ...molar, fdi: 46 }, filter)).toBe(false)
    expect(pieceVisible({ ...molar, fdi: null, kind: "gingiva" }, filter)).toBe(false)
  })
})
