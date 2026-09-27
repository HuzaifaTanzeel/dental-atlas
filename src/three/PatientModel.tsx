import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { Bounds, useGLTF } from "@react-three/drei"
import type { ThreeEvent } from "@react-three/fiber"
import { parseFdiNodeName } from "@/data/fdi-teeth"
import { patients } from "@/data/patients"
import { Color, Mesh, MeshPhysicalMaterial, type BufferGeometry, type Object3D } from "three"
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"

const patient = patients[0]
if (!patient) {
  throw new Error("Patient manifest is empty")
}

const modelUrl = `/data/${patient.file}`

const enamelColor = new Color("#f3e4cf")
// Milder than a full teal replacement so the tooth still reads as enamel.
const selectedColor = enamelColor.clone().lerp(new Color("#6bd9c7"), 0.45)
const hoverEmissive = new Color("#5f8794")

// MeshPhysicalMaterial clearcoat is the wet top layer; sheen is the soft highlight.
// https://github.com/mrdoob/three.js/blob/r186/src/materials/MeshPhysicalMaterial.js
const toothMaterial = new MeshPhysicalMaterial({
  color: "#f3e4cf",
  roughness: 0.4,
  metalness: 0,
  clearcoat: 0.9,
  clearcoatRoughness: 0.16,
  envMapIntensity: 1.2,
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

function smoothForDisplay(geometry: BufferGeometry): BufferGeometry {
  const source = geometry.clone()
  source.deleteAttribute("normal")
  const welded = mergeVertices(source, 1e-4)
  source.dispose()
  welded.computeVertexNormals()
  return welded
}

function applyMaterials(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.geometry = smoothForDisplay(child.geometry)
    // One shared material would tint every tooth. Each tooth gets its own clone.
    child.material = child.name.startsWith("Gingiva") ? gingivaMaterial : toothMaterial.clone()
  })
}

function presentLowerJaw(root: Object3D) {
  root.getObjectByName("Upper")?.removeFromParent()
}

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
    material.emissive.set("#1d6b64")
    material.emissiveIntensity = 0.4
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
  onReady: () => void
  hoveredFdi: number | null
  selectedFdi: number | null
  armed: { current: boolean }
  onHover: (fdi: number | null) => void
  onLeave: (fdi: number) => void
  onSelect: (fdi: number) => void
  onClear: () => void
}

export function PatientModel({
  onReady,
  hoveredFdi,
  selectedFdi,
  armed,
  onHover,
  onLeave,
  onSelect,
  onClear,
}: PatientModelProps) {
  const { scene } = useGLTF(modelUrl)
  const onReadyRef = useRef(onReady)
  const clone = useMemo(() => {
    const next = scene.clone(true)
    applyMaterials(next)
    presentLowerJaw(next)
    return next
  }, [scene])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    onReadyRef.current()
  }, [clone])

  useLayoutEffect(() => {
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const fdi = parseFdiNodeName(child.name)
      if (fdi === null) return
      const material = child.material
      if (!(material instanceof MeshPhysicalMaterial)) return
      const mode = fdi === selectedFdi ? "selected" : fdi === hoveredFdi ? "hover" : "rest"
      paintTooth(material, mode)
    })
  }, [clone, hoveredFdi, selectedFdi])

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    // Stop the ray at the front surface so a tooth behind this one is not also hovered.
    // https://r3f.docs.pmnd.rs/api/events
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
    onHover(fdi)
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
    // drei 10.7.9 divides the fit animation by maxDuration, so 0 is not a valid duration.
    // A 10ms fit still lands before a drag can fight the orbit target.
    <Bounds fit clip observe margin={1.2} maxDuration={0.01}>
      <primitive
        object={clone}
        onPointerOver={handleOver}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
        onClick={handleClick}
      />
    </Bounds>
  )
}

useGLTF.preload(modelUrl)
