import { useEffect, useMemo, useRef } from "react"
import { Bounds, useGLTF } from "@react-three/drei"
import { patients } from "@/data/patients"
import { Mesh, MeshStandardMaterial, type Object3D } from "three"

const patient = patients[0]
if (!patient) {
  throw new Error("Patient manifest is empty")
}

const modelUrl = `/data/${patient.file}`

const toothMaterial = new MeshStandardMaterial({
  color: "#f3efe6",
  roughness: 0.6,
  metalness: 0,
})

const gingivaMaterial = new MeshStandardMaterial({
  color: "#c4a99a",
  roughness: 0.72,
  metalness: 0,
})

function applyMaterials(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.material = child.name.startsWith("Gingiva") ? gingivaMaterial : toothMaterial
  })
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
    <Bounds fit clip observe margin={1.4} maxDuration={0.01}>
      <primitive object={clone} />
    </Bounds>
  )
}

useGLTF.preload(modelUrl)
