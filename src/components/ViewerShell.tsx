import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useProgress } from "@react-three/drei"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowUpRight,
  Info,
  Layers3,
  Library,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  X,
} from "lucide-react"
import { CaseLibrary } from "@/components/CaseLibrary"
import { PatientSwitcher } from "@/components/PatientSwitcher"
import { StudioButton } from "@/components/StudioButton"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MotionCard, useStudioMotion } from "@/studio-motion"
import {
  emptyCaseLibraryFilters,
  parseTagsParam,
  serializeTagsParam,
  type CaseLibraryFilters,
} from "@/data/case-library"
import { getFdiTooth } from "@/data/fdi-teeth"
import { missingToothMessage, searchFdiTeeth } from "@/data/fdi-search"
import { getPatientById, patientDisplayName, patientModelUrl, patients } from "@/data/patients"
import { ToothDetailPanel } from "@/components/ToothDetailPanel"
import { ToothSearchPanel } from "@/components/ToothSearchPanel"
import { DentalScene } from "@/three/DentalScene"
import type { ModelPiece } from "@/three/model-space"
import { pieceVisible } from "@/three/model-space"
import { prefetchNeighborPatients } from "@/three/prefetch-patients"

/** Temporary: keep the old dropdown for one release while the case library ships. */
const SHOW_LEGACY_PATIENT_SELECT = true

function readCaseIdFromUrl(): string | null {
  try {
    const value = new URLSearchParams(window.location.search).get("case")
    if (value && patients.some((patient) => patient.id === value)) return value
  } catch {
    /* ignore */
  }
  return null
}

function readFiltersFromUrl(): CaseLibraryFilters {
  try {
    return {
      tags: parseTagsParam(new URLSearchParams(window.location.search).get("tags")),
      query: "",
    }
  } catch {
    return emptyCaseLibraryFilters()
  }
}

function writeCaseLibraryUrl(caseId: string, filters: CaseLibraryFilters) {
  try {
    const params = new URLSearchParams(window.location.search)
    params.set("case", caseId)
    if (filters.tags.length > 0) params.set("tags", serializeTagsParam(filters.tags))
    else params.delete("tags")
    const query = params.toString()
    const next = query ? `${window.location.pathname}?${query}` : window.location.pathname
    window.history.replaceState(null, "", next)
  } catch {
    /* ignore */
  }
}
import {
  GINGIVA_LAYER,
  STUDIO_VIEWS,
  TOOTH_LAYERS,
  initialStudio,
  type StudioState,
  type StudioView,
  type ToothLayerId,
} from "@/studio-state"

const defaultPatient = patients[0]
if (!defaultPatient) {
  throw new Error("Patient manifest is empty")
}

type PanelId = "layers" | "search" | null

function LoadingCard({ progress }: { progress: number }) {
  const { reduce, panel } = useStudioMotion()
  const width = `${Math.max(4, Math.min(100, Math.round(progress)))}%`
  return (
    <motion.div
      className="loading-layer"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0 }}
      transition={panel}
    >
      <div className="loading glass" role="status">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div>
          <strong>Preparing the scan</strong>
          <span>{Math.round(progress)}% · Reading the dental surfaces</span>
          <div className="loading-track">
            <motion.i initial={false} animate={{ width }} transition={panel} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ErrorCard({ message, onReload }: { message: string; onReload: () => void }) {
  return (
    <div className="loading-layer">
      <div className="loading glass error" role="alert">
        <strong>The scan could not be loaded</strong>
        <p>{message}</p>
        <StudioButton type="button" onClick={onReload}>
          Reload viewer
        </StudioButton>
      </div>
    </div>
  )
}

function sceneCaption(studio: StudioState, selectedName: string | null): string {
  if (studio.isolate && selectedName) return selectedName.toUpperCase()
  if (studio.explode > 0.85) return "EVERY TOOTH"
  if (studio.explode > 0.05) return "OPENING THE BITE"
  if (studio.arches.length === 2) return "IN OCCLUSION"
  if (studio.arches.length === 1) return studio.arches[0] === "upper" ? "UPPER ARCH" : "LOWER ARCH"
  if (!studio.gingiva) return "CROWNS ONLY"
  return "DENTAL ARCH"
}

export function ViewerShell() {
  const { reduce, micro, panel: panelMotion } = useStudioMotion()
  const [session, setSession] = useState(0)
  const urlCaseId = readCaseIdFromUrl()
  const [activePatientId, setActivePatientId] = useState(urlCaseId ?? defaultPatient.id)
  const [studio, setStudio] = useState<StudioState>(initialStudio)
  const [pieces, setPieces] = useState<ModelPiece[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredFdi, setHoveredFdi] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null)
  const [panel, setPanel] = useState<PanelId>(null)
  const [about, setAbout] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(() => urlCaseId === null)
  const [libraryFilters, setLibraryFilters] = useState<CaseLibraryFilters>(() => readFiltersFromUrl())
  const [query, setQuery] = useState("")
  const [searchNotice, setSearchNotice] = useState<string | null>(null)
  const [focusFdi, setFocusFdi] = useState<number | null>(null)
  const [focusSerial, setFocusSerial] = useState(0)
  const [announcement, setAnnouncement] = useState("")
  const { progress } = useProgress()
  const archesRef = useRef(studio.arches)
  archesRef.current = studio.arches

  const activePatient = useMemo(() => getPatientById(activePatientId), [activePatientId])
  const modelUrl = useMemo(() => patientModelUrl(activePatient), [activePatient])
  const selectedTooth = selectedFdi === null ? null : getFdiTooth(selectedFdi)
  const posedView: StudioView = studio.explode > 0.8 ? "occlusal" : studio.view

  const counts = useMemo(() => {
    const next = {
      upper: 0,
      lower: 0,
      incisor: 0,
      canine: 0,
      premolar: 0,
      molar: 0,
      gingiva: 0,
    }
    for (const piece of pieces) {
      if (piece.kind === "gingiva") next.gingiva += 1
      else {
        next[piece.arch] += 1
        next[piece.kind] += 1
      }
    }
    return next
  }, [pieces])

  const visibleCount = useMemo(
    () =>
      pieces.filter((piece) =>
        pieceVisible(piece, {
          arches: studio.arches,
          layers: studio.layers,
          gingiva: studio.gingiva,
          isolate: studio.isolate,
          selectedFdi,
        }),
      ).length,
    [pieces, selectedFdi, studio.arches, studio.gingiva, studio.isolate, studio.layers],
  )

  const presentFdi = useMemo(() => {
    const ids = new Set<number>()
    for (const piece of pieces) {
      if (piece.fdi !== null) ids.add(piece.fdi)
    }
    return ids
  }, [pieces])
  const scanReady = ready && presentFdi.size > 0
  const results = useMemo(() => searchFdiTeeth(query), [query])
  const soleMiss = scanReady && results.length === 1 && results[0] && !presentFdi.has(results[0].fdi) ? results[0] : null
  const listedNotice = searchNotice ?? (soleMiss ? missingToothMessage(soleMiss) : null)

  useEffect(() => {
    if (!soleMiss) return
    setAnnouncement(missingToothMessage(soleMiss))
  }, [soleMiss])

  useEffect(() => {
    if (!ready) return
    return prefetchNeighborPatients(activePatientId)
  }, [activePatientId, ready])

  const clearSelection = useCallback(() => {
    setSelectedFdi(null)
    setFocusFdi(null)
    setStudio((current) => ({ ...current, isolate: false }))
    setAnnouncement((current) => (current.startsWith("Selected") ? "Selection cleared" : current))
  }, [])

  const chooseTooth = useCallback((fdi: number, fromSearch = false) => {
    const tooth = getFdiTooth(fdi)
    const onThisArch = archesRef.current.includes(tooth.arch)
    if (!fromSearch && !onThisArch) return
    setSelectedFdi(fdi)
    setSearchNotice(null)
    setPanel(null)
    setAbout(false)
    if (fromSearch) {
      setFocusFdi(fdi)
      setFocusSerial((current) => current + 1)
    } else {
      setFocusFdi((current) => (current === fdi ? current : null))
    }
    setStudio((current) => ({
      ...current,
      isolate: false,
      rotate: false,
      explode: fromSearch ? 0 : current.explode,
      arches: fromSearch && !current.arches.includes(tooth.arch) ? [tooth.arch] : current.arches,
      layers: current.layers.includes(tooth.type) ? current.layers : [...current.layers, tooth.type],
    }))
    setAnnouncement(`Selected FDI ${tooth.fdi}, ${tooth.name}`)
  }, [])

  const pickSearchResult = useCallback(
    (fdi: number) => {
      const tooth = getFdiTooth(fdi)
      if (!scanReady) {
        const message = "The scan is still loading."
        setSearchNotice(message)
        setAnnouncement(message)
        return
      }
      if (!presentFdi.has(fdi)) {
        const message = missingToothMessage(tooth)
        setSearchNotice(message)
        setAnnouncement(message)
        return
      }
      chooseTooth(fdi, true)
    },
    [chooseTooth, presentFdi, scanReady],
  )

  const handleReady = useCallback(() => {
    setReady(true)
  }, [])

  const handleError = useCallback((message: string) => {
    setError(message)
  }, [])

  const handleHover = useCallback((fdi: number | null, point?: { x: number; y: number }) => {
    setHoveredFdi(fdi)
    if (fdi !== null && point) setHoverPoint(point)
  }, [])

  const handleLeave = useCallback((fdi: number) => {
    setHoveredFdi((current) => (current === fdi ? null : current))
  }, [])

  const handlePieces = useCallback((next: ModelPiece[]) => {
    setPieces(next)
  }, [])

  const switchPatient = useCallback(
    (nextId: string) => {
      writeCaseLibraryUrl(nextId, libraryFilters)
      if (nextId === activePatientId) return
      setReady(false)
      setPieces([])
      setHoveredFdi(null)
      setSelectedFdi(null)
      setFocusFdi(null)
      setSearchNotice(null)
      setAnnouncement("")
      setPanel(null)
      setStudio((current) => ({ ...current, explode: 0, isolate: false, rotate: false, reset: current.reset + 1 }))
      setActivePatientId(nextId)
    },
    [activePatientId, libraryFilters],
  )

  const openCaseFromLibrary = useCallback(
    (nextId: string) => {
      switchPatient(nextId)
      setLibraryOpen(false)
      setAbout(false)
      const patient = getPatientById(nextId)
      setAnnouncement(`Opened ${patientDisplayName(patient)}`)
    },
    [switchPatient],
  )

  const updateLibraryFilters = useCallback(
    (next: CaseLibraryFilters) => {
      setLibraryFilters(next)
      writeCaseLibraryUrl(activePatientId, next)
    },
    [activePatientId],
  )

  const resetStudio = useCallback(() => {
    setSelectedFdi(null)
    setHoveredFdi(null)
    setFocusFdi(null)
    setSearchNotice(null)
    setPanel(null)
    setQuery("")
    setAnnouncement("View reset")
    setStudio((current) => ({ ...initialStudio, reset: current.reset + 1 }))
  }, [])

  const openPanel = (next: Exclude<PanelId, null>) => {
    setAbout(false)
    setPanel((current) => (current === next ? null : next))
  }

  const setView = (view: StudioView) => {
    setStudio((current) => ({ ...current, view, rotate: false }))
  }

  const applyPreset = (preset: "all" | "teeth" | "molars") => {
    setSelectedFdi(null)
    setFocusFdi(null)
    setStudio((current) => ({
      ...current,
      isolate: false,
      layers: preset === "molars" ? ["molar"] : ["incisor", "canine", "premolar", "molar"],
      gingiva: preset === "all",
    }))
  }

  const setArchMode = (mode: "upper" | "lower" | "occlusion") => {
    setSelectedFdi(null)
    setFocusFdi(null)
    setHoveredFdi(null)
    setStudio((current) => ({
      ...current,
      isolate: false,
      arches: mode === "occlusion" ? ["upper", "lower"] : [mode],
    }))
    setAnnouncement(mode === "occlusion" ? "Occlusion" : mode === "upper" ? "Upper arch" : "Lower arch")
  }

  const soloLayer = (layer: ToothLayerId) => {
    setSelectedFdi(null)
    setFocusFdi(null)
    setStudio((current) => ({ ...current, isolate: false, gingiva: false, layers: [layer] }))
  }

  const toggleLayer = (layer: ToothLayerId) => {
    setSelectedFdi(null)
    setFocusFdi(null)
    setStudio((current) => {
      const layers = current.layers.includes(layer)
        ? current.layers.filter((item) => item !== layer)
        : [...current.layers, layer]
      return { ...current, isolate: false, layers }
    })
  }

  const toggleIsolate = () => {
    setStudio((current) => ({
      ...current,
      isolate: !current.isolate,
      explode: 0,
      rotate: false,
    }))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      if (event.key === "/" && !typing) {
        event.preventDefault()
        setAbout(false)
        setPanel("search")
      }
      if (event.key === "Escape") {
        if (about) setAbout(false)
        else if (panel) setPanel(null)
        else clearSelection()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [about, clearSelection, panel])

  const reload = () => {
    setError(null)
    setReady(false)
    setPieces([])
    setHoveredFdi(null)
    setSelectedFdi(null)
    setAnnouncement("")
    setSession((value) => value + 1)
  }

  const hoveredTooth = hoveredFdi === null ? null : getFdiTooth(hoveredFdi)
  const hoverStyle =
    hoveredTooth && hoverPoint
      ? {
          left: Math.max(8, Math.min(hoverPoint.x + 14, window.innerWidth - 250)),
          top: Math.max(8, Math.min(hoverPoint.y + 18, window.innerHeight - 48)),
        }
      : null

  const archMode = studio.arches.includes("upper") && studio.arches.includes("lower") ? "occlusion" : studio.arches[0] === "upper" ? "upper" : "lower"
  const allOn = studio.layers.length === 4 && studio.gingiva && !studio.isolate
  const teethOn = studio.layers.length === 4 && !studio.gingiva && !studio.isolate
  const molarsOn = studio.layers.length === 1 && studio.layers[0] === "molar" && !studio.gingiva && !studio.isolate

  return (
    <main className="studio">
      {error ? (
        <ErrorCard message={error} onReload={reload} />
      ) : (
        <DentalScene
          key={session}
          patientKey={activePatientId}
          modelUrl={modelUrl}
          studio={studio}
          selectedFdi={selectedFdi}
          hoveredFdi={hoveredFdi}
          onReady={handleReady}
          onError={handleError}
          onHover={handleHover}
          onLeave={handleLeave}
          focusFdi={focusFdi}
          focusSerial={focusSerial}
          onSelect={chooseTooth}
          onClear={clearSelection}
          onPieces={handlePieces}
        />
      )}
      <div className="vignette" />
      <AnimatePresence>
        {!error && !ready ? <LoadingCard key="loading" progress={progress} /> : null}
      </AnimatePresence>

      <motion.header
        className="identity"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={panelMotion}
      >
        <div className="eyebrow">
          <span className="status-dot" /> INTERACTIVE DENTISTRY
        </div>
        <h1>
          Dental Atlas <span className="edition">3D</span>
        </h1>
        <div className="identity-meta">
          {patients.length} scans <span>·</span> Teeth3DS+
          <span>·</span> {patientDisplayName(activePatient)}
        </div>
        {SHOW_LEGACY_PATIENT_SELECT ? (
          <PatientSwitcher value={activePatientId} onChange={switchPatient} />
        ) : null}
      </motion.header>

      <motion.nav
        className="top-actions"
        aria-label="Explorer"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={panelMotion}
      >
        <StudioButton
          type="button"
          className={libraryOpen ? "active" : ""}
          aria-expanded={libraryOpen}
          onClick={() => {
            setAbout(false)
            setPanel(null)
            setLibraryOpen(true)
          }}
        >
          <Library size={16} aria-hidden="true" />
          <span>Cases</span>
        </StudioButton>
        <StudioButton type="button" className={panel === "search" ? "active" : ""} onClick={() => openPanel("search")}>
          <Search size={16} aria-hidden="true" />
          <span>Find a tooth</span>
          <kbd>/</kbd>
        </StudioButton>
        <StudioButton
          type="button"
          className="icon-button"
          aria-label="About this atlas"
          onClick={() => {
            setPanel(null)
            setLibraryOpen(false)
            setAbout(true)
          }}
        >
          <Info size={18} aria-hidden="true" />
        </StudioButton>
      </motion.nav>

      <CaseLibrary
        open={libraryOpen}
        filters={libraryFilters}
        onFiltersChange={updateLibraryFilters}
        activePatientId={activePatientId}
        onSelect={openCaseFromLibrary}
        onClose={() => setLibraryOpen(false)}
      />

      <motion.nav
        className="arch-tabs"
        aria-label="Jaw"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={panelMotion}
      >
        <StudioButton type="button" aria-pressed={archMode === "upper"} onClick={() => setArchMode("upper")}>
          Upper
        </StudioButton>
        <StudioButton type="button" aria-pressed={archMode === "occlusion"} onClick={() => setArchMode("occlusion")}>
          Occlusion
        </StudioButton>
        <StudioButton type="button" aria-pressed={archMode === "lower"} onClick={() => setArchMode("lower")}>
          Lower
        </StudioButton>
      </motion.nav>

      <MotionCard
        className={`layers-panel glass gap-0 py-0 ring-0 shadow-none${panel === "layers" ? " mobile-open" : ""}`}
        aria-label="Dental layers"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={panelMotion}
      >
        <div className="panel-heading">
          <span>Layers</span>
          <StudioButton type="button" className="mobile-only icon-button" aria-label="Close layers" onClick={() => setPanel(null)}>
            <X size={16} aria-hidden="true" />
          </StudioButton>
          <span className="count-pill desktop-only">{visibleCount}</span>
        </div>
        <div className="layer-presets">
          <StudioButton type="button" aria-pressed={allOn} onClick={() => applyPreset("all")}>
            All
          </StudioButton>
          <StudioButton type="button" aria-pressed={teethOn} onClick={() => applyPreset("teeth")}>
            Teeth
          </StudioButton>
          <StudioButton type="button" aria-pressed={molarsOn} onClick={() => applyPreset("molars")}>
            Molars
          </StudioButton>
        </div>
        <div className="system-list">
          {TOOTH_LAYERS.map((layer) => (
            <div className={`system-row${studio.layers.includes(layer.id) ? " enabled" : ""}`} key={layer.id}>
              <StudioButton type="button" className="system-name" title={`Show only ${layer.name.toLowerCase()}`} onClick={() => soloLayer(layer.id)}>
                <span className="system-dot" style={{ background: layer.color }} />
                <span>{layer.name}</span>
                <span className="system-count">{counts[layer.id]}</span>
              </StudioButton>
              <Switch
                checked={studio.layers.includes(layer.id)}
                aria-label={`Show ${layer.name.toLowerCase()}`}
                onCheckedChange={() => toggleLayer(layer.id)}
              />
            </div>
          ))}
          <div className={`system-row${studio.gingiva ? " enabled" : ""}`}>
            <StudioButton type="button" className="system-name" onClick={() => setStudio((current) => ({ ...current, gingiva: !current.gingiva, isolate: false }))}>
              <span className="system-dot" style={{ background: GINGIVA_LAYER.color }} />
              <span>{GINGIVA_LAYER.name}</span>
              <span className="system-count">{counts.gingiva}</span>
            </StudioButton>
            <Switch
              checked={studio.gingiva}
              aria-label="Show gingiva"
              onCheckedChange={() => {
                setSelectedFdi(null)
                setFocusFdi(null)
                setStudio((current) => ({ ...current, gingiva: !current.gingiva, isolate: false }))
              }}
            />
          </div>
        </div>
        <div className="panel-foot">
          <span>{visibleCount} pieces visible</span>
          <StudioButton
            type="button"
            onClick={() => {
              setSelectedFdi(null)
              setFocusFdi(null)
              setStudio((current) => ({ ...current, layers: [], gingiva: false, isolate: false }))
            }}
          >
            Hide all
          </StudioButton>
        </div>
      </MotionCard>

      <AnimatePresence>
      {panel === "search" ? (
        <MotionCard
          key="search"
          className="search-panel glass gap-0 py-0 ring-0 shadow-none"
          role="search"
          aria-label="Find a tooth"
          initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
          transition={panelMotion}
          style={{ transformOrigin: "top right" }}
        >
        <ToothSearchPanel
          query={query}
          onQueryChange={(value) => {
            setQuery(value)
            setSearchNotice(null)
          }}
          results={results}
          presentFdi={presentFdi}
          scanReady={scanReady}
          notice={listedNotice}
          onPick={pickSearchResult}
          onClose={() => {
            setSearchNotice(null)
            setPanel(null)
          }}
        />
        </MotionCard>
      ) : null}
      </AnimatePresence>

      <motion.nav
        className="view-controls"
        aria-label="Camera"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={panelMotion}
      >
        {STUDIO_VIEWS.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger
              render={
                <StudioButton
                  type="button"
                  className={posedView === item.id ? "active" : ""}
                  aria-pressed={posedView === item.id}
                  aria-label={item.title}
                  disabled={studio.explode > 0.8 && item.id !== "occlusal"}
                  onClick={() => setView(item.id)}
                />
              }
            >
              {item.label}
            </TooltipTrigger>
            <TooltipContent side="left">{item.title}</TooltipContent>
          </Tooltip>
        ))}
        <span className="view-sep" />
        <Tooltip>
          <TooltipTrigger
            render={
              <StudioButton
                type="button"
                className={studio.rotate ? "active" : ""}
                aria-label={studio.rotate ? "Pause rotation" : "Rotate scan"}
                disabled={studio.explode >= 0.4 || studio.isolate}
                onClick={() => setStudio((current) => ({ ...current, rotate: !current.rotate }))}
              />
            }
          >
            {studio.rotate ? <Pause size={16} /> : <RotateCw size={16} />}
          </TooltipTrigger>
          <TooltipContent side="left">Auto rotate</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <StudioButton type="button" aria-label="Reset view and layers" onClick={resetStudio} />
            }
          >
            <RotateCcw size={16} />
          </TooltipTrigger>
          <TooltipContent side="left">Reset</TooltipContent>
        </Tooltip>
      </motion.nav>

      <motion.div
        className="scene-caption"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={panelMotion}
      >
        <span className="caption-line" />
        <span>{sceneCaption(studio, selectedTooth?.name ?? null)}</span>
        <span className="caption-line" />
      </motion.div>

      <motion.div
        className="dock-anchor"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={panelMotion}
      >
      <div className="bottom-dock glass">
        <StudioButton type="button" className="mobile-only dock-side" onClick={() => openPanel("layers")} aria-label="Open layers">
          <Layers3 size={18} aria-hidden="true" />
          <span>Layers</span>
        </StudioButton>
        <div className="explode-control">
          <div className="explode-label">
            <label id="explode-label" htmlFor="explode-slider">
              Separate teeth
            </label>
            <output htmlFor="explode-slider">
              {Math.round(studio.explode * 100)}
              <span>%</span>
            </output>
          </div>
          <input
            id="explode-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            aria-labelledby="explode-label"
            value={Math.round(studio.explode * 100)}
            style={{ ["--p" as string]: `${Math.round(studio.explode * 100)}%` }}
            onChange={(event) => {
              const explode = Number(event.target.value) / 100
              setStudio((current) => ({
                ...current,
                explode,
                rotate: false,
                isolate: explode > 0 ? false : current.isolate,
              }))
            }}
          />
          <div className="slider-endpoints">
            <span>Together</span>
            <span>Every tooth</span>
          </div>
        </div>
        <StudioButton type="button" className="dock-side" onClick={resetStudio} aria-label="Assemble and reset">
          <RotateCcw size={16} aria-hidden="true" />
          <span>Reset</span>
        </StudioButton>
      </div>
      </motion.div>

      <footer className="studio-footer">
        <span>
          {studio.explode > 0.8 ? "Drag to pan" : "Drag to orbit"} <b>·</b> Pinch to zoom <b>·</b> Tap a tooth
        </span>
        <span className="footer-links">
          <a href="https://crns-smartvision.github.io/teeth3ds/" target="_blank" rel="noreferrer">
            Teeth3DS+
          </a>
          <a href="https://github.com/abenhamadou/3DTeethSeg22_challenge" target="_blank" rel="noreferrer">
            3DTeethSeg
          </a>
          <StudioButton
            type="button"
            onClick={() => {
              setPanel(null)
              setAbout(true)
            }}
          >
            Source & credits <ArrowUpRight size={12} aria-hidden="true" />
          </StudioButton>
        </span>
      </footer>

      <AnimatePresence>
        {!error && selectedFdi !== null && selectedTooth ? (
          <MotionCard
            key="detail"
            className="detail-sheet glass gap-0 py-0 ring-0 shadow-none"
            aria-label={`Selected tooth, FDI ${selectedTooth.fdi}`}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: 12 }}
            transition={panelMotion}
          >
            <ToothDetailPanel
              fdi={selectedFdi}
              isolated={studio.isolate}
              onClose={clearSelection}
              onToggleIsolate={toggleIsolate}
            />
          </MotionCard>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {hoverStyle && hoveredTooth ? (
          <motion.div
            key={hoveredTooth.fdi}
            className="part-hover"
            style={hoverStyle}
            role="tooltip"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 4 }}
            transition={micro}
          >
            {hoveredTooth.name}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
      {about ? (
        <motion.div
          key="about"
          className="about-backdrop"
          onClick={() => setAbout(false)}
          role="presentation"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={panelMotion}
        >
          <MotionCard
            className="about-sheet glass gap-0 py-0 ring-0 shadow-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(event) => event.stopPropagation()}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: 12 }}
            transition={panelMotion}
          >
            <StudioButton type="button" className="sheet-close" aria-label="Close about" onClick={() => setAbout(false)}>
              <X size={16} aria-hidden="true" />
            </StudioButton>
            <div className="eyebrow">SOURCE & SCOPE</div>
            <h2 id="about-title">A dentition, revealed.</h2>
            <p className="about-lead">Real intraoral scans, opened tooth by tooth.</p>
            <div className="about-copy">
              <p>
                <strong>{patients.length} patients · Teeth3DS+</strong>
                <br />
                Each scan keeps the upper and lower crowns from the 3DTeethSeg challenge, including the gingiva surface.
              </p>
              <p>
                Colors mark tooth type so the arches are easier to read. Separation, isolation, and camera moves are for
                exploration. This is an anatomical reference, not a diagnostic or treatment tool.
              </p>
              <h3>Source</h3>
              <p>
                Teeth3DS+, the dataset for the MICCAI 3DTeethSeg'22 and 3DTeethLand'24 challenges (Ben-Hamadou et al.),
                licensed CC BY-NC-ND 4.0.
              </p>
              <a href="https://crns-smartvision.github.io/teeth3ds/" target="_blank" rel="noreferrer">
                Dataset homepage <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <a href="https://github.com/abenhamadou/3DTeethSeg22_challenge" target="_blank" rel="noreferrer">
                3DTeethSeg challenge <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <a href="https://arxiv.org/pdf/2210.06094.pdf" target="_blank" rel="noreferrer">
                Read the source paper <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </MotionCard>
        </motion.div>
      ) : null}
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </main>
  )
}
