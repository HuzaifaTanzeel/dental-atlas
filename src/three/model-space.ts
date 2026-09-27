import { Box3, MathUtils, Sphere, Vector3 } from "three"
import type { ArchId, StudioView, ToothLayerId } from "@/studio-state"

export type ModelPiece = {
  fdi: number | null
  arch: ArchId
  kind: ToothLayerId | "gingiva"
  center: [number, number, number]
  half: [number, number, number]
}

export type PieceFilter = {
  arches: readonly ArchId[]
  layers: readonly ToothLayerId[]
  gingiva: boolean
  isolate: boolean
  selectedFdi: number | null
}

// Scanner meshes are Z-up, with anterior toward -Y.
// OrbitControls and the stage are Y-up, so scanner +Z becomes world +Y and scanner -Y becomes world +Z.
export function modelPointToWorld(center: [number, number, number]): Vector3 {
  const [x, y, z] = center
  return new Vector3(x, z, -y)
}

export function pieceVisible(piece: Pick<ModelPiece, "fdi" | "arch" | "kind">, filter: PieceFilter): boolean {
  if (!filter.arches.includes(piece.arch)) return false
  if (filter.isolate) return piece.fdi !== null && piece.fdi === filter.selectedFdi
  if (piece.kind === "gingiva") return filter.gingiva
  return filter.layers.includes(piece.kind)
}

export function cameraFocusFilter(
  filter: PieceFilter,
  focusFdi: number | null,
  pieces: readonly Pick<ModelPiece, "fdi" | "arch">[],
): PieceFilter {
  if (focusFdi === null) return filter
  const piece = pieces.find((item) => item.fdi === focusFdi)
  if (!piece || !filter.arches.includes(piece.arch)) return filter
  return { ...filter, isolate: true, selectedFdi: focusFdi }
}

export type ArchDisplay = {
  offset: [number, number, number]
  mirrorZ: boolean
  pivotZ: number
}

const restingArch: ArchDisplay = { offset: [0, 0, 0], mirrorZ: false, pivotZ: 0 }

function archBounds(pieces: readonly ModelPiece[], arch: ArchId): Box3 | null {
  const box = new Box3()
  let found = false
  for (const piece of pieces) {
    if (piece.arch !== arch) continue
    const [x, y, z] = piece.center
    const [halfX, halfY, halfZ] = piece.half
    box.expandByPoint(new Vector3(x - halfX, y - halfY, z - halfZ))
    box.expandByPoint(new Vector3(x + halfX, y + halfY, z + halfZ))
    found = true
  }
  return found ? box : null
}

// Scans store both jaws facing the same way, crowns toward +Z.
// The upper arch is mirrored so its crowns point down. In occlusion it is
// lifted until those crowns sit just above the lower arch.
export function archDisplay(pieces: readonly ModelPiece[], arches: readonly ArchId[]): Record<ArchId, ArchDisplay> {
  const resting = { upper: restingArch, lower: restingArch }
  if (!arches.includes("upper")) return resting

  const upperBox = archBounds(pieces, "upper")
  if (!upperBox) return resting

  const pivotZ = (upperBox.min.z + upperBox.max.z) / 2
  let offsetZ = 0
  if (arches.includes("lower")) {
    const lowerBox = archBounds(pieces, "lower")
    if (lowerBox) {
      const gap = Math.max(lowerBox.getSize(new Vector3()).z, upperBox.getSize(new Vector3()).z) * 0.08
      offsetZ = lowerBox.max.z + gap - upperBox.min.z
    }
  }

  return {
    lower: restingArch,
    upper: { offset: [0, 0, offsetZ], mirrorZ: true, pivotZ },
  }
}

export function displayedModelPoint(
  center: readonly [number, number, number],
  display: ArchDisplay,
): [number, number, number] {
  const [x, y, z] = center
  const mirroredZ = display.mirrorZ ? 2 * display.pivotZ - z : z
  return [x + display.offset[0], y + display.offset[1], mirroredZ + display.offset[2]]
}

const VIEW_DIRECTION: Record<StudioView, [number, number, number]> = {
  "three-quarter": [0.46, 0.58, 0.84],
  occlusal: [0.02, 1, 0.04],
  front: [0, 0.3, 1],
  side: [1, 0.36, 0.22],
}

export function viewDirection(view: StudioView): Vector3 {
  const [x, y, z] = VIEW_DIRECTION[view]
  return new Vector3(x, y, z).normalize()
}

export type StudioPose = {
  position: Vector3
  target: Vector3
  floorY: number
  stageRadius: number
  stageCenter: Vector3
  stageAbove: boolean
}

export function studioPose(
  pieces: ModelPiece[],
  filter: PieceFilter,
  view: StudioView,
  explode: number,
  fov: number,
): StudioPose | null {
  const shown = pieces.filter((piece) => pieceVisible(piece, filter))
  if (shown.length === 0) return null

  const display = archDisplay(pieces, filter.arches)
  const box = new Box3()
  for (const piece of shown) {
    const world = modelPointToWorld(displayedModelPoint(piece.center, display[piece.arch]))
    const [halfX, halfY, halfZ] = piece.half
    const worldHalf = new Vector3(halfX, halfZ, halfY)
    box.expandByPoint(world.clone().sub(worldHalf))
    box.expandByPoint(world.clone().add(worldHalf))
  }

  const target = box.getCenter(new Vector3())
  const sphere = box.getBoundingSphere(new Sphere())
  const size = box.getSize(new Vector3())
  const posedView = !filter.isolate && explode > 0.8 ? "occlusal" : view
  const grow = filter.isolate ? 0 : explode * 52
  const padding = filter.isolate ? 1.7 : 1.08
  const halfFov = MathUtils.degToRad(fov) / 2
  const distance = Math.max(((sphere.radius + grow) / Math.sin(halfFov)) * padding, filter.isolate ? 14 : 36)
  const position = target.clone().addScaledVector(viewDirection(posedView), distance)
  const stageRadius = Math.max(18, Math.max(size.x, size.z) * 0.46)
  const stageAbove = filter.arches.includes("upper") && !filter.arches.includes("lower")
  const floorY = stageAbove ? box.max.y + 0.35 : box.min.y - 0.35

  return {
    position,
    target,
    floorY,
    stageRadius,
    stageCenter: new Vector3(target.x, floorY, target.z),
    stageAbove,
  }
}
