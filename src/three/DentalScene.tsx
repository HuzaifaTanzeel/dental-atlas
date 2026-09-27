import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { PatientModel } from "@/three/PatientModel"

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
          {/* Untextured ivory scans disappear on a white clear color. */}
          <color attach="background" args={["#d5d8dc"]} />
          <CanvasLabel onContextLost={() => onError(contextLostError)} />
          <hemisphereLight args={["#ffffff", "#b7bcc2", 0.7]} />
          <directionalLight position={[-2, 4, 3]} intensity={1.8} color="#fffaf4" />
          <directionalLight position={[2, 1.5, -3]} intensity={0.9} color="#e7eef8" />
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
