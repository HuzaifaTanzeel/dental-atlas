import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type { ThreeEvent } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import { getFdiTooth, parseFdiNodeName } from "@/data/fdi-teeth"
import type { ArchId } from "@/studio-state"
import { archDisplay, pieceVisible, type ModelPiece, type PieceFilter } from "@/three/model-space"
import { Color, MathUtils, Mesh, MeshPhysicalMaterial, Vector3, type BufferGeometry, type Object3D } from "three"
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"

const enamelColor = new Color("#f3e4cf")
const selectedColor = new Color("#1ec8b8")
const hoverEmissive = new Color("#5f8794")

const toothMaterial = new MeshPhysicalMaterial({
  color: "#f3e4cf",
  roughness: 0.4,
  metalness: 0,
  clearcoat: 0.9,
  clearcoatRoughness: 0.16,
  envMapIntensity: 0.72,
})

const gingivaMaterial = new MeshPhysicalMaterial({
  color: "#c45c58",
  roughness: 0.55,
  metalness: 0,
  sheen: 0.7,
  sheenColor: "#ffc2b6",
  sheenRoughness: 0.42,
  envMapIntensity: 0.45,
})

type AnimatedPiece = {
  mesh: Mesh
  fdi: number | null
  arch: ArchId
  kind: ModelPiece["kind"]
  rest: Vector3
  dir: Vector3
  radial: number
  lift: number
  gingiva: boolean
}

function smoothForDisplay(geometry: BufferGeometry): BufferGeometry {
  const source = geometry.clone()
  source.deleteAttribute("normal")
  const welded = mergeVertices(source, 1e-4)
  source.dispose()
  welded.computeVertexNormals()
  welded.computeBoundingSphere()
  return welded
}

function gingivaArch(name: string): ArchId | null {
  if (name === "Gingiva-upper") return "upper"
  if (name === "Gingiva-lower") return "lower"
  return null
}

function meshBounds(mesh: Mesh): { center: Vector3; half: [number, number, number] } {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
  const bounds = mesh.geometry.boundingBox
  if (!bounds) return { center: new Vector3(), half: [1, 1, 1] }
  const size = bounds.getSize(new Vector3())
  return {
    center: bounds.getCenter(new Vector3()),
    half: [size.x / 2, size.y / 2, size.z / 2],
  }
}

function preparePatientModel(source: Object3D): { clone: Object3D; pieces: ModelPiece[]; animated: AnimatedPiece[] } {
  const clone = source.clone(true)
  const meshes: Mesh[] = []
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.geometry = smoothForDisplay(child.geometry)
    const gingiva = gingivaArch(child.name)
    child.material = gingiva ? gingivaMaterial.clone() : toothMaterial.clone()
    meshes.push(child)
  })

  const teeth = meshes.filter((mesh) => parseFdiNodeName(mesh.name) !== null)
  const centroid = new Vector3()
  const boundsByMesh = new Map<Mesh, { center: Vector3; half: [number, number, number] }>()
  for (const mesh of teeth) {
    const bounds = meshBounds(mesh)
    boundsByMesh.set(mesh, bounds)
    centroid.add(bounds.center)
  }
  if (teeth.length > 0) centroid.multiplyScalar(1 / teeth.length)

  const pieces: ModelPiece[] = []
  const animated: AnimatedPiece[] = []

  for (const mesh of meshes) {
    const gingiva = gingivaArch(mesh.name)
    const fdi = parseFdiNodeName(mesh.name)
    const bounds = boundsByMesh.get(mesh) ?? meshBounds(mesh)
    const center = bounds.center
    let arch: ArchId
    let kind: ModelPiece["kind"]
    if (gingiva) {
      arch = gingiva
      kind = "gingiva"
    } else if (fdi !== null) {
      const tooth = getFdiTooth(fdi)
      arch = tooth.arch
      kind = tooth.type
    } else {
      continue
    }

    const dir = new Vector3(center.x - centroid.x, center.y - centroid.y, 0)
    if (dir.lengthSq() < 1) dir.set(0, -1, 0)
    dir.normalize()
    const liftSign = arch === "upper" ? 1 : -1

    pieces.push({
      fdi,
      arch,
      kind,
      center: [center.x, center.y, center.z],
      half: bounds.half,
    })
    animated.push({
      mesh,
      fdi,
      arch,
      kind,
      rest: mesh.position.clone(),
      dir,
      radial: gingiva ? 10 : 34,
      lift: liftSign * (gingiva ? 18 : 32),
      gingiva: gingiva !== null,
    })
  }

  return { clone, pieces, animated }
}

function disposeClone(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.geometry.dispose()
    const material = child.material
    if (material instanceof MeshPhysicalMaterial && material !== gingivaMaterial && material !== toothMaterial) {
      material.dispose()
    }
  })
}

function ignoreRaycast() {}

function fdiFromHit(object: Object3D): number | null {
  let current: Object3D | null = object
  while (current) {
    if (current.name.startsWith("Gingiva")) return null
    const fdi = parseFdiNodeName(current.name)
    if (fdi !== null) return fdi
    current = current.parent
  }
  return null
}

function paintTooth(material: MeshPhysicalMaterial, mode: "rest" | "hover" | "selected") {
  if (mode === "selected") {
    material.color.copy(selectedColor)
    material.emissive.set("#0c7f8a")
    material.emissiveIntensity = 0.9
    return
  }
  material.color.copy(enamelColor)
  if (mode === "hover") {
    material.emissive.copy(hoverEmissive)
    material.emissiveIntensity = 0.55
    return
  }
  material.emissive.set("#000000")
  material.emissiveIntensity = 0
}

type PatientModelProps = {
  modelUrl: string
  filter: PieceFilter
  explode: number
  onReady: () => void
  onPieces: (pieces: ModelPiece[]) => void
  hoveredFdi: number | null
  selectedFdi: number | null
  armed: { current: boolean }
  onHover: (fdi: number | null, point?: { x: number; y: number }) => void
  onLeave: (fdi: number) => void
  onSelect: (fdi: number) => void
  onClear: () => void
}

export function PatientModel({
  modelUrl,
  filter,
  explode,
  onReady,
  onPieces,
  hoveredFdi,
  selectedFdi,
  armed,
  onHover,
  onLeave,
  onSelect,
  onClear,
}: PatientModelProps) {
  const { scene } = useGLTF(modelUrl)
  const prepared = useMemo(() => preparePatientModel(scene), [scene])
  const onReadyRef = useRef(onReady)
  const onPiecesRef = useRef(onPieces)
  const amount = useRef(0)
  const reduced = useRef(false)

  useEffect(() => {
    onReadyRef.current = onReady
    onPiecesRef.current = onPieces
  }, [onPieces, onReady])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => {
      reduced.current = media.matches
    }
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    onPiecesRef.current(prepared.pieces)
    onReadyRef.current()
  }, [prepared])

  useEffect(() => () => disposeClone(prepared.clone), [prepared])

  const layout = useMemo(
    () => archDisplay(prepared.pieces, filter.arches),
    [filter.arches, prepared.pieces],
  )

  useLayoutEffect(() => {
    amount.current = 0
    for (const piece of prepared.animated) {
      piece.mesh.position.copy(piece.rest)
      piece.mesh.scale.set(1, 1, 1)
      if (!piece.gingiva) continue
      const material = piece.mesh.material
      if (!(material instanceof MeshPhysicalMaterial)) continue
      material.opacity = 1
      material.transparent = false
      material.depthWrite = true
    }
  }, [prepared])

  useLayoutEffect(() => {
    for (const piece of prepared.animated) {
      if (piece.gingiva) continue
      const material = piece.mesh.material
      if (!(material instanceof MeshPhysicalMaterial)) continue
      if (piece.fdi === null) continue
      const mode = piece.fdi === selectedFdi ? "selected" : piece.fdi === hoveredFdi ? "hover" : "rest"
      paintTooth(material, mode)
    }
  }, [hoveredFdi, prepared, selectedFdi])

  useFrame((_, dt) => {
    const target = filter.isolate ? 0 : explode
    const next = reduced.current ? target : MathUtils.damp(amount.current, target, 7, dt)
    const moved = Math.abs(amount.current - target) > 0.0004
    if (moved) {
      amount.current = Math.abs(next - target) < 0.0004 ? target : next
    }
    const spread = amount.current
    const currentFilter = filter

    for (const piece of prepared.animated) {
      const shown = pieceVisible(piece, currentFilter)
      const pose = layout[piece.arch]
      const radial = spread * piece.radial
      piece.mesh.scale.set(1, 1, pose.mirrorZ ? -1 : 1)
      piece.mesh.position.set(
        piece.rest.x + piece.dir.x * radial + pose.offset[0],
        piece.rest.y + piece.dir.y * radial + pose.offset[1],
        pose.mirrorZ
          ? 2 * pose.pivotZ + spread * piece.lift + pose.offset[2]
          : piece.rest.z + spread * piece.lift + pose.offset[2],
      )
      if (piece.gingiva) {
        const material = piece.mesh.material
        if (material instanceof MeshPhysicalMaterial) {
          const opacity = shown ? Math.max(0, 1 - spread / 0.82) : 0
          material.opacity = opacity
          material.transparent = opacity < 0.999
          material.depthWrite = opacity > 0.25
          piece.mesh.visible = shown && opacity > 0.04
        } else {
          piece.mesh.visible = shown
        }
        piece.mesh.raycast = piece.mesh.visible ? Mesh.prototype.raycast : ignoreRaycast
        continue
      }
      piece.mesh.visible = shown
      piece.mesh.raycast = shown ? Mesh.prototype.raycast : ignoreRaycast
    }
  })

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
  }

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const canvas = event.nativeEvent.target
    if (event.pointerType === "touch" || event.buttons > 0) {
      if (canvas instanceof HTMLCanvasElement) canvas.style.cursor = "grab"
      return
    }
    const fdi = fdiFromHit(event.object)
    onHover(fdi, { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY })
    if (canvas instanceof HTMLCanvasElement) canvas.style.cursor = fdi === null ? "grab" : "pointer"
  }

  const handleOut = (event: ThreeEvent<PointerEvent>) => {
    const canvas = event.nativeEvent.target
    if (canvas instanceof HTMLCanvasElement) canvas.style.cursor = "grab"
    const fdi = fdiFromHit(event.object)
    if (fdi !== null) onLeave(fdi)
  }

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (!armed.current) return
    const fdi = fdiFromHit(event.object)
    if (fdi === null) onClear()
    else onSelect(fdi)
  }

  return (
    <primitive
      object={prepared.clone}
      onPointerOver={handleOver}
      onPointerMove={handleMove}
      onPointerOut={handleOut}
      onClick={handleClick}
    />
  )
}
