import { useCallback, useState } from "react"
import { useProgress } from "@react-three/drei"
import { Loader2 } from "lucide-react"
import { patients } from "@/data/patients"
import { DentalScene } from "@/three/DentalScene"

const patient = patients[0]
if (!patient) {
  throw new Error("Patient manifest is empty")
}

function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <div role="status" className="absolute inset-0 z-10 grid place-items-center">
      <div className="flex items-center gap-3 rounded-lg bg-background/95 px-4 py-3 text-sm text-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>Loading scan {Math.round(progress)}%</span>
      </div>
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
  const { progress } = useProgress()

  const handleReady = useCallback(() => {
    setReady(true)
  }, [])

  const handleError = useCallback((message: string) => {
    setError(message)
  }, [])

  const reload = () => {
    setError(null)
    setReady(false)
    setSession((value) => value + 1)
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#d5d8dc] text-foreground">
      {error ? (
        <ErrorPanel message={error} onReload={reload} />
      ) : (
        <div className="absolute inset-0">
          <DentalScene key={session} onReady={handleReady} onError={handleError} />
        </div>
      )}
      {!error && !ready ? <LoadingOverlay progress={progress} /> : null}
      <header className="pointer-events-none absolute top-4 left-4 z-20 max-w-md">
        <p className="text-xs font-medium tracking-wide text-foreground/70">Open Dental Atlas</p>
        <h1 className="text-lg font-medium">{patient.label}</h1>
      </header>
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1 px-4 pb-4 text-xs">
        <p className="pointer-events-auto max-w-xl">
          Scan from{" "}
          <a
            className="underline underline-offset-2"
            href="https://crns-smartvision.github.io/teeth3ds/"
            target="_blank"
            rel="noreferrer"
          >
            Teeth3DS+
          </a>{" "}
          (Ben-Hamadou et al.).{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/abenhamadou/3DTeethSeg22_challenge"
            target="_blank"
            rel="noreferrer"
          >
            3DTeethSeg challenge
          </a>
          .
        </p>
        <p className="text-foreground/80">Drag to orbit · Scroll or pinch to zoom</p>
      </footer>
    </main>
  )
}
