import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { BackSide, Mesh, MeshStandardMaterial, PMREMGenerator } from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { PatientModel } from "@/three/PatientModel"

const studioBackground = "#d7dbe0"

type DentalSceneProps = {
  onReady?: () => void
  onError?: (message: string) => void
}

const webGLError = "This browser could not start the 3D viewer. Please try a browser with WebGL enabled."
const contextLostError = "The 3D session was paused by your device. Reload to continue."

function useMaxDpr(): [number, number] {
  const query = "(max-width: 767px)"
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setNarrow(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return narrow ? [1, 1.5] : [1, 2]
}

type BoundaryProps = {
  children: ReactNode
  onError: (message: string) => void
}

type BoundaryState = {
  failed: boolean
}

class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    const raw = error instanceof Error ? error.message : "The scan could not be loaded."
    const message = /webgl/i.test(raw) ? webGLError : raw
    this.props.onError(message)
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

function StudioEnvironment() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    room.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const material = object.material
      if (material instanceof MeshStandardMaterial && material.side === BackSide) {
        material.color.set("#e6d7ce")
      }
    })
    const environment = pmrem.fromScene(room, 0.04)
    scene.environment = environment.texture
    gl.toneMappingExposure = 1.05
    room.dispose()
    pmrem.dispose()
    return () => {
      environment.dispose()
      if (scene.environment === environment.texture) scene.environment = null
    }
  }, [gl, scene])

  return null
}

function CanvasLabel({ onContextLost }: { onContextLost: () => void }) {
  const gl = useThree((state) => state.gl)
  const onContextLostRef = useRef(onContextLost)

  useEffect(() => {
    onContextLostRef.current = onContextLost
  }, [onContextLost])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.setAttribute("aria-label", "Dental scan. Drag to orbit, pinch or scroll to zoom.")
    const onLost = (event: Event) => {
      event.preventDefault()
      onContextLostRef.current()
    }
    canvas.addEventListener("webglcontextlost", onLost)
    return () => canvas.removeEventListener("webglcontextlost", onLost)
  }, [gl])

  return null
}

export function DentalScene({ onReady = () => {}, onError = () => {} }: DentalSceneProps) {
  const dpr = useMaxDpr()

  return (
    <div className="h-full w-full">
      <SceneErrorBoundary onError={onError}>
        <Canvas
          className="h-full w-full"
          dpr={dpr}
          camera={{ fov: 40, position: [0, 0, 200] }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          fallback={null}
        >
          <color attach="background" args={[studioBackground]} />
          <StudioEnvironment />
          <CanvasLabel onContextLost={() => onError(contextLostError)} />
          <hemisphereLight args={["#fff6f0", "#cbb8b0", 0.25]} />
          <directionalLight position={[-2.2, 4.5, 2.6]} intensity={2.15} color="#fff4ea" />
          <directionalLight position={[2.6, 1.4, -2.4]} intensity={0.32} color="#dce6f2" />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
          <SceneErrorBoundary onError={onError}>
            <Suspense fallback={null}>
              <PatientModel onReady={onReady} />
            </Suspense>
          </SceneErrorBoundary>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  )
}
