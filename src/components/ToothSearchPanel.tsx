import type { FdiTooth } from "@/data/fdi-teeth"
import { TOOTH_LAYERS } from "@/studio-state"
import { X } from "lucide-react"

type ToothSearchPanelProps = {
  query: string
  onQueryChange: (value: string) => void
  results: FdiTooth[]
  presentFdi: ReadonlySet<number>
  scanReady: boolean
  notice: string | null
  onPick: (fdi: number) => void
  onClose: () => void
}

export function ToothSearchPanel({
  query,
  onQueryChange,
  results,
  presentFdi,
  scanReady,
  notice,
  onPick,
  onClose,
}: ToothSearchPanelProps) {
  const note = !scanReady
    ? "The scan is still loading."
    : query.trim()
      ? "Matches from the FDI chart. Teeth missing from this scan stay in the list."
      : "All 32 permanent teeth. Missing ones stay in the list."

  return (
    <section className="search-panel glass" aria-label="Find a tooth">
      <div className="panel-heading">
        <span>Find a tooth</span>
        <button type="button" className="icon-button" aria-label="Close search" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <input
        autoFocus
        aria-label="Search teeth by name or FDI number"
        placeholder="Molar, canine, 36…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          const first = results[0]
          if (event.key === "Enter" && first) onPick(first.fdi)
        }}
      />
      {results.length === 0 ? (
        <p className="search-note">No teeth match that search.</p>
      ) : (
        <ul className="search-results">
          {results.map((tooth) => {
            const absent = scanReady && !presentFdi.has(tooth.fdi)
            const accent = TOOTH_LAYERS.find((layer) => layer.id === tooth.type)?.color
            return (
              <li key={tooth.fdi}>
                <button type="button" className={absent ? "is-absent" : undefined} onClick={() => onPick(tooth.fdi)}>
                  <span className="system-dot" style={{ background: accent }} />
                  <span className="search-result-name">{tooth.name}</span>
                  <span className="small-number">{absent ? "Not in this scan" : `FDI ${tooth.fdi}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {notice ? <p className="search-miss">{notice}</p> : null}
      <p className="search-note">{note}</p>
    </section>
  )
}
