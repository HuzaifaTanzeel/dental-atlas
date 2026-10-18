import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import {
  ACESFilmicToneMapping,
  BackSide,
  DoubleSide,
  MOUSE,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  TOUCH,
  Vector3,
  type PerspectiveCamera,
} from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { PerfOverlay } from "@/components/PerfOverlay"
import {
  beginPatientLoad,
  currentLoadEpoch,
  isPerfEnabled,
  logPerfTable,
  noteFirstFrameIfNeeded,
  recordDrawCalls,
} from "@/perf"
import type { StudioState } from "@/studio-state"
import { PatientModel } from "@/three/PatientModel"
import { cameraFocusFilter, studioPose, type ModelPiece, type PieceFilter } from "@/three/model-space"
import { PointerTap, tapThreshold } from "@/three/pointer-tap"

const studioBackground = "#8a969f"
const cameraFov = 34

type DentalSceneProps = {
  patientKey: string
  modelUrl: string
  studio: StudioState
  selectedFdi: number | null
  hoveredFdi: number | null
  focusFdi?: number | null
  focusSerial?: number
  onReady?: () => void
  onError?: (message: string) => void
  onHover: (fdi: number | null, point?: { x: number; y: number }) => void
  onLeave: (fdi: number) => void
  onSelect: (fdi: number) => void
  onClear: () => void
  onPieces: (pieces: ModelPiece[]) => void
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
    gl.toneMapping = ACESFilmicToneMapping
    gl.toneMappingExposure = 1.02
    room.dispose()
    pmrem.dispose()
    return () => {
      environment.dispose()
      if (scene.environment === environment.texture) scene.environment = null
    }
  }, [gl, scene])

  return null
}

type OrbitLike = {
  target: Vector3
  update: () => void
  enableDamping: boolean
  autoRotate: boolean
  autoRotateSpeed: number
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

function CameraDirector({
  patientKey,
  pieces,
  filter,
  view,
  explode,
  reset,
  rotate,
  focusSerial,
}: {
  patientKey: string
  pieces: ModelPiece[]
  filter: PieceFilter
  view: StudioState["view"]
  explode: number
  reset: number
  rotate: boolean
  focusSerial: number
}) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as OrbitLike | null
  const size = useThree((state) => state.size)
  const pose = useMemo(() => {
    const next = studioPose(pieces, filter, view, explode, cameraFov)
    if (!next || size.width >= 768) return next
    const offset = next.position.clone().sub(next.target).multiplyScalar(1.34)
    return { ...next, position: next.target.clone().add(offset) }
  }, [explode, filter, pieces, size.width, view])
  const intro = useRef(true)
  const steer = useRef(false)
  const dragging = useRef(false)
  const settled = useRef(false)
  const poseRef = useRef(pose)
  const reduced = useRef(false)
  const revision = `${patientKey}:${reset}`
  const revisionRef = useRef(revision)
  const focusSerialRef = useRef(focusSerial)

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  useEffect(() => {
    if (!controls) return
    const onStart = () => {
      dragging.current = true
      steer.current = true
      settled.current = true
    }
    const onEnd = () => {
      dragging.current = false
    }
    controls.addEventListener("start", onStart)
    controls.addEventListener("end", onEnd)
    return () => {
      controls.removeEventListener("start", onStart)
      controls.removeEventListener("end", onEnd)
    }
  }, [controls])

  useFrame((_, dt) => {
    if (focusSerialRef.current !== focusSerial) {
      focusSerialRef.current = focusSerial
      if (!intro.current) {
        steer.current = false
        settled.current = false
        dragging.current = false
      }
    }
    if (revisionRef.current !== revision) {
      revisionRef.current = revision
      intro.current = true
      steer.current = false
      dragging.current = false
      settled.current = false
    }
    if (poseRef.current !== pose) {
      const previous = poseRef.current
      const hadPose = previous !== null
      poseRef.current = pose
      const reframed =
        !previous ||
        !pose ||
        previous.position.distanceTo(pose.position) > 0.5 ||
        previous.target.distanceTo(pose.target) > 0.5
      if (hadPose && reframed && !intro.current && !dragging.current) {
        steer.current = false
        settled.current = false
      }
    }

    if (!(camera instanceof Object) || !("isPerspectiveCamera" in camera)) return
    const viewCamera = camera as PerspectiveCamera
    frameOffset(viewCamera, size.width, size.height)
    if (!pose || !controls) return

    if (intro.current) {
      intro.current = false
      const direction = pose.position.clone().sub(pose.target).normalize()
      viewCamera.position.copy(pose.position)
      if (!reduced.current) viewCamera.position.addScaledVector(direction, 62)
      controls.target.copy(pose.target)
      controls.update()
      steer.current = false
      settled.current = reduced.current
      if (reduced.current) viewCamera.position.copy(pose.position)
      return
    }

    controls.autoRotate = Boolean(rotate && settled.current && !steer.current && !filter.isolate && explode < 0.4)
    controls.autoRotateSpeed = 0.7

    if (steer.current || settled.current || !pose) {
      controls.enableDamping = true
      return
    }

    controls.enableDamping = false
    const blend = reduced.current ? 1 : 1 - Math.exp(-4.8 * dt)
    viewCamera.position.lerp(pose.position, blend)
    controls.target.lerp(pose.target, blend)
    controls.update()
    if (reduced.current || viewCamera.position.distanceTo(pose.position) < 0.45) {
      viewCamera.position.copy(pose.position)
      controls.target.copy(pose.target)
      controls.update()
      settled.current = true
      controls.enableDamping = true
    }
  })

  return null
}

function frameOffset(camera: PerspectiveCamera, width: number, height: number) {
  if (width < 768) {
    camera.clearViewOffset()
    return
  }

  const fullWidth = Math.round(width * 1.2)
  const offsetX = Math.round(width * 0.04)
  const fullHeight = Math.round(height * 1.16)
  const offsetY = Math.round(height * 0.1)
  camera.setViewOffset(fullWidth, fullHeight, offsetX, offsetY, width, height)
}

function StudioPlatform({
  pieces,
  filter,
  view,
  explode,
}: {
  pieces: ModelPiece[]
  filter: PieceFilter
  view: StudioState["view"]
  explode: number
}) {
  const pose = useMemo(() => {
    if (filter.isolate || explode > 0.52) return null
    return studioPose(pieces, filter, view, 0, cameraFov)
  }, [explode, filter, pieces, view])

  if (!pose) return null

  const { stageCenter, stageRadius, stageAbove } = pose
  return (
    <group position={[stageCenter.x, stageCenter.y, stageCenter.z]} rotation={stageAbove ? [Math.PI, 0, 0] : [0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <circleGeometry args={[stageRadius * 1.08, 80]} />
        <meshStandardMaterial color="#6d7b86" roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[stageRadius * 0.78, stageRadius * 0.82, 0.55, 80]} />
        <meshStandardMaterial color="#74828c" metalness={0.08} roughness={0.72} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
        <ringGeometry args={[stageRadius * 0.74, stageRadius * 0.755, 96]} />
        <meshBasicMaterial color="#e7eef2" transparent opacity={0.55} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function SelectionGestures({
  tapRef,
  armed,
  onHover,
}: {
  tapRef: { current: PointerTap }
  armed: { current: boolean }
  onHover: (fdi: number | null, point?: { x: number; y: number }) => void
}) {
  const gl = useThree((state) => state.gl)
  const onHoverRef = useRef(onHover)

  useEffect(() => {
    onHoverRef.current = onHover
  }, [onHover])

  useEffect(() => {
    const canvas = gl.domElement
    const tap = tapRef.current
    const down = (event: PointerEvent) => {
      armed.current = false
      onHoverRef.current(null)
      if (event.currentTarget instanceof HTMLElement) event.currentTarget.style.cursor = "grab"
      tap.down(event.pointerId, event.clientX, event.clientY, tapThreshold(event.pointerType))
    }
    const move = (event: PointerEvent) => {
      tap.move(event.pointerId, event.clientX, event.clientY)
    }
    const up = (event: PointerEvent) => {
      armed.current = tap.up(event.pointerId, event.clientX, event.clientY)
    }
    const cancel = (event: PointerEvent) => {
      armed.current = false
      tap.cancel(event.pointerId)
    }
    canvas.addEventListener("pointerdown", down, true)
    canvas.addEventListener("pointermove", move, true)
    canvas.addEventListener("pointerup", up, true)
    canvas.addEventListener("pointercancel", cancel, true)
    return () => {
      canvas.removeEventListener("pointerdown", down, true)
      canvas.removeEventListener("pointermove", move, true)
      canvas.removeEventListener("pointerup", up, true)
      canvas.removeEventListener("pointercancel", cancel, true)
    }
  }, [armed, gl, tapRef])

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
    canvas.setAttribute(
      "aria-label",
      "Dental scan. Drag to orbit, pinch or scroll to zoom. Click or tap a tooth to inspect it.",
    )
    const onLost = (event: Event) => {
      event.preventDefault()
      onContextLostRef.current()
    }
    canvas.addEventListener("webglcontextlost", onLost)
    return () => canvas.removeEventListener("webglcontextlost", onLost)
  }, [gl])

  return null
}

/** Records first painted frame + draw calls when `?perf=1`. Renders nothing. */
function PerfFrameProbe({ modelReady }: { modelReady: boolean }) {
  const gl = useThree((state) => state.gl)
  const epochRef = useRef(currentLoadEpoch())
  const loggedRef = useRef(false)

  useEffect(() => {
    if (!isPerfEnabled()) return
    epochRef.current = currentLoadEpoch()
    loggedRef.current = false
  }, [modelReady])

  useFrame(() => {
    if (!isPerfEnabled() || !modelReady) return
    noteFirstFrameIfNeeded(epochRef.current)
    recordDrawCalls(gl.info.render.calls)
    if (!loggedRef.current) {
      loggedRef.current = true
      queueMicrotask(() => logPerfTable())
    }
  })

  return null
}

export function DentalScene({
  patientKey,
  modelUrl,
  studio,
  selectedFdi,
  hoveredFdi,
  focusFdi = null,
  focusSerial = 0,
  onReady = () => {},
  onError = () => {},
  onHover,
  onLeave,
  onSelect,
  onClear,
  onPieces,
}: DentalSceneProps) {
  const dpr = useMaxDpr()
  const tap = useRef(new PointerTap())
  const armed = useRef(false)
  const [pieces, setPieces] = useState<ModelPiece[]>([])
  const [framedPatient, setFramedPatient] = useState(patientKey)
  if (framedPatient !== patientKey) {
    setFramedPatient(patientKey)
    setPieces([])
  }

  useEffect(() => {
    beginPatientLoad(modelUrl)
  }, [modelUrl, patientKey])
  const filter = useMemo<PieceFilter>(
    () => ({
      arches: studio.arches,
      layers: studio.layers,
      gingiva: studio.gingiva,
      isolate: studio.isolate,
      selectedFdi,
    }),
    [selectedFdi, studio.arches, studio.gingiva, studio.isolate, studio.layers],
  )
  const cameraFilter = useMemo(
    () => cameraFocusFilter(filter, focusFdi, pieces),
    [filter, focusFdi, pieces],
  )

  const handlePieces = (next: ModelPiece[]) => {
    setPieces(next)
    onPieces(next)
  }

  const spread = studio.explode >= 0.8
  const perfOn = isPerfEnabled()

  return (
    <div className="scene">
      <SceneErrorBoundary onError={onError}>
        <Canvas
          dpr={dpr}
          camera={{ fov: cameraFov, near: 0.5, far: 4000, position: [70, 30, 150] }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          fallback={null}
          onPointerMissed={() => {
            if (armed.current) onClear()
          }}
        >
          <color attach="background" args={[studioBackground]} />
          <StudioEnvironment />
          <CanvasLabel onContextLost={() => onError(contextLostError)} />
          <SelectionGestures tapRef={tap} armed={armed} onHover={onHover} />
          {perfOn ? <PerfFrameProbe modelReady={pieces.length > 0} /> : null}
          <hemisphereLight args={["#f4efe8", "#6d7c8a", 0.55]} />
          <directionalLight position={[-2.4, 5.2, 3.4]} intensity={2.05} color="#fff6ee" />
          <directionalLight position={[3.2, 1.8, -2.6]} intensity={0.62} color="#d5e2f2" />
          <StudioPlatform pieces={pieces} filter={filter} view={studio.view} explode={studio.explode} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.085}
            minDistance={6}
            maxDistance={2400}
            enableRotate={!spread}
            autoRotate={false}
            mouseButtons={{
              LEFT: spread ? MOUSE.PAN : MOUSE.ROTATE,
              MIDDLE: MOUSE.DOLLY,
              RIGHT: MOUSE.PAN,
            }}
            touches={{
              ONE: spread ? TOUCH.PAN : TOUCH.ROTATE,
              TWO: TOUCH.DOLLY_PAN,
            }}
          />
          <CameraDirector
            patientKey={patientKey}
            pieces={pieces}
            filter={cameraFilter}
            view={studio.view}
            explode={studio.explode}
            reset={studio.reset}
            rotate={studio.rotate}
            focusSerial={focusSerial}
          />
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <SceneErrorBoundary onError={onError}>
              <Suspense fallback={null}>
                <PatientModel
                  key={patientKey}
                  modelUrl={modelUrl}
                  filter={filter}
                  explode={studio.explode}
                  onReady={onReady}
                  onPieces={handlePieces}
                  hoveredFdi={hoveredFdi}
                  selectedFdi={selectedFdi}
                  armed={armed}
                  onHover={onHover}
                  onLeave={onLeave}
                  onSelect={onSelect}
                  onClear={onClear}
                />
              </Suspense>
            </SceneErrorBoundary>
          </group>
        </Canvas>
      </SceneErrorBoundary>
      {perfOn ? <PerfOverlay /> : null}
    </div>
  )
}
