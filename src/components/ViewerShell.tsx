import { useCallback, useEffect, useState } from "react"
import { useProgress } from "@react-three/drei"
import { Loader2 } from "lucide-react"
import { getFdiTooth } from "@/data/fdi-teeth"
import { patients } from "@/data/patients"
import { ToothDetailPanel } from "@/components/ToothDetailPanel"
import { DentalScene } from "@/three/DentalScene"

const patient = patients[0]
if (!patient) {
  throw new Error("Patient manifest is empty")
}

const [patientTitle, patientDetail] = patient.label.split(" — ")
const studioBackground = "#d7dbe0"

function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-[#d7dbe0]/75">
      <p className="flex items-center gap-2 text-sm text-[#1c1f24]">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Preparing the scan {Math.round(progress)}%
      </p>
    </div>
  )
}

function ErrorPanel({ message, onReload }: { message: string; onReload: () => void }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center px-4">
      <div role="alert" className="max-w-md rounded-lg bg-background px-5 py-4 text-foreground">
        <h2 className="text-base font-medium">The scan could not be loaded</h2>
        <p className="mt-2 text-sm">{message}</p>
        <button
          type="button"
          className="mt-4 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={onReload}
        >
          Reload
        </button>
      </div>
    </div>
  )
}

export function ViewerShell() {
  const [session, setSession] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredFdi, setHoveredFdi] = useState<number | null>(null)
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const { progress } = useProgress()

  const handleReady = useCallback(() => {
    setReady(true)
  }, [])

  const handleError = useCallback((message: string) => {
    setError(message)
  }, [])

  const handleHover = useCallback((fdi: number | null) => {
    setHoveredFdi(fdi)
  }, [])

  const handleLeave = useCallback((fdi: number) => {
    setHoveredFdi((current) => (current === fdi ? null : current))
  }, [])

  const handleSelect = useCallback((fdi: number) => {
    const tooth = getFdiTooth(fdi)
    setSelectedFdi(fdi)
    setAnnouncement(`Selected FDI ${tooth.fdi}, ${tooth.name}`)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFdi(null)
    setAnnouncement((current) => (current.startsWith("Selected") ? "Selection cleared" : current))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [clearSelection])

  const reload = () => {
    setError(null)
    setReady(false)
    setHoveredFdi(null)
    setSelectedFdi(null)
    setAnnouncement("")
    setSession((value) => value + 1)
  }

  return (
    <main className="relative h-dvh overflow-hidden text-[#1c1f24]" style={{ background: studioBackground }}>
      {error ? (
        <ErrorPanel message={error} onReload={reload} />
      ) : (
        <div className="absolute inset-0">
          <DentalScene
            key={session}
            onReady={handleReady}
            onError={handleError}
            hoveredFdi={hoveredFdi}
            selectedFdi={selectedFdi}
            onHover={handleHover}
            onLeave={handleLeave}
            onSelect={handleSelect}
            onClear={clearSelection}
          />
        </div>
      )}
      {!error && !ready ? <LoadingOverlay progress={progress} /> : null}
      {!error && selectedFdi !== null ? <ToothDetailPanel fdi={selectedFdi} onClose={clearSelection} /> : null}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <header className="pointer-events-none absolute top-5 left-5 z-20 max-w-sm sm:top-7 sm:left-7">
        <p className="text-[11px] font-medium tracking-[0.16em] text-[#1c1f24]/55">OPEN DENTAL ATLAS</p>
        <h1 className="mt-1 text-[1.65rem] leading-none font-medium tracking-tight">{patientTitle}</h1>
        <p className="mt-2 text-sm text-[#1c1f24]/65">
          Lower arch{patientDetail ? ` · ${patientDetail}` : ""}
        </p>
      </header>
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-5 pb-5 text-xs text-[#1c1f24]/60 sm:px-7 sm:pb-6">
        <p>Drag to orbit · Click or tap a tooth</p>
        <p className="pointer-events-auto max-w-[14rem] text-right">
          <a
            className="underline decoration-[#1c1f24]/30 underline-offset-2 hover:decoration-[#1c1f24]"
            href="https://crns-smartvision.github.io/teeth3ds/"
            target="_blank"
            rel="noreferrer"
          >
            Teeth3DS+
          </a>
          {" · "}
          <a
            className="underline decoration-[#1c1f24]/30 underline-offset-2 hover:decoration-[#1c1f24]"
            href="https://github.com/abenhamadou/3DTeethSeg22_challenge"
            target="_blank"
            rel="noreferrer"
          >
            3DTeethSeg
          </a>
        </p>
      </footer>
    </main>
  )
}
