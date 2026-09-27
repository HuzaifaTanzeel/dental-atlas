import { useEffect, useMemo, useRef } from "react"
import { Bounds, useGLTF } from "@react-three/drei"
import { patients } from "@/data/patients"
import { Mesh, MeshPhysicalMaterial, type BufferGeometry, type Object3D } from "three"
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"

const patient = patients[0]
if (!patient) {
  throw new Error("Patient manifest is empty")
}

const modelUrl = `/data/${patient.file}`

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
    child.material = child.name.startsWith("Gingiva") ? gingivaMaterial : toothMaterial
  })
}

function presentLowerJaw(root: Object3D) {
  root.getObjectByName("Upper")?.removeFromParent()
}

type PatientModelProps = {
  onReady: () => void
}

export function PatientModel({ onReady }: PatientModelProps) {
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

  return (
    // drei 10.7.9 divides the fit animation by maxDuration, so 0 is not a valid duration.
    // A 10ms fit still lands before a drag can fight the orbit target.
    <Bounds fit clip observe margin={1.2} maxDuration={0.01}>
      <primitive object={clone} />
    </Bounds>
  )
}

useGLTF.preload(modelUrl)
