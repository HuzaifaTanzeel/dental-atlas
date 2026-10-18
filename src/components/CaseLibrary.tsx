import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Odontogram } from "@/components/Odontogram"
import { StudioButton } from "@/components/StudioButton"
import {
  caseTitle,
  emptyCaseLibraryFilters,
  filterCases,
  tagChipsFromPatients,
  toggleTag,
  type CaseLibraryFilters,
} from "@/data/case-library"
import { patients, type PatientRecord } from "@/data/patients"
import { prefetchPatient } from "@/three/prefetch-patients"

type CaseLibraryProps = {
  open: boolean
  filters: CaseLibraryFilters
  onFiltersChange: (next: CaseLibraryFilters) => void
  activePatientId: string
  onSelect: (patientId: string) => void
  onClose: () => void
}

export function CaseLibrary({
  open,
  filters,
  onFiltersChange,
  activePatientId,
  onSelect,
  onClose,
}: CaseLibraryProps) {
  const titleId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const [focusIndex, setFocusIndex] = useState(0)

  const chips = useMemo(() => tagChipsFromPatients(patients), [])
  const visible = useMemo(() => filterCases(patients, filters), [filters])
  const filterKey = `${filters.tags.join(",")}|${filters.query}`
  const safeFocusIndex =
    visible.length === 0 ? 0 : Math.min(focusIndex, visible.length - 1)

  useEffect(() => {
    if (!open) return
    setFocusIndex(0)
    const timer = window.setTimeout(() => searchRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open, filterKey])

  if (!open) return null

  const setQuery = (query: string) => onFiltersChange({ ...filters, query })
  const clearFilters = () => onFiltersChange(emptyCaseLibraryFilters())
  const onToggleTag = (tag: string) =>
    onFiltersChange({ ...filters, tags: toggleTag(filters.tags, tag) })

  const moveFocus = (delta: number) => {
    if (visible.length === 0) return
    setFocusIndex((current) => (current + delta + visible.length) % visible.length)
  }

  const activateFocused = () => {
    const entry = visible[safeFocusIndex]
    if (entry) onSelect(entry.id)
  }

  return (
    <div className="case-library-layer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="case-library glass">
        <header className="case-library-header">
          <div>
            <p className="case-library-eyebrow">Browse cases</p>
            <h2 id={titleId}>Case library</h2>
            <p className="case-library-lead">
              Filter by missing-tooth pattern, then open a scan. Charts are SVG only — no 3D until you pick a
              case.
            </p>
          </div>
          <StudioButton type="button" className="icon-button" aria-label="Close case library" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </StudioButton>
        </header>

        <div className="case-library-tools">
          <label className="case-library-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search cases</span>
            <input
              ref={searchRef}
              type="search"
              value={filters.query}
              placeholder="Search summaries — try “lower molar” or “46”"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  moveFocus(1)
                } else if (event.key === "ArrowUp") {
                  event.preventDefault()
                  moveFocus(-1)
                } else if (event.key === "Enter") {
                  event.preventDefault()
                  activateFocused()
                } else if (event.key === "Escape") {
                  event.preventDefault()
                  onClose()
                }
              }}
            />
          </label>
          <StudioButton
            type="button"
            className="case-library-clear"
            disabled={filters.tags.length === 0 && filters.query.trim().length === 0}
            onClick={clearFilters}
          >
            Clear filters
          </StudioButton>
        </div>

        <div className="case-library-chips" role="group" aria-label="Filter by pattern">
          {chips.map((chip) => {
            const pressed = filters.tags.includes(chip.tag)
            return (
              <button
                key={chip.tag}
                type="button"
                className={pressed ? "case-chip is-active" : "case-chip"}
                aria-pressed={pressed}
                onClick={() => onToggleTag(chip.tag)}
              >
                <span>{chip.label}</span>
                <em>{chip.count}</em>
              </button>
            )
          })}
        </div>

        <p className="case-library-count" aria-live="polite">
          {visible.length} of {patients.length} cases
        </p>

        <div
          className="case-library-grid"
          role="listbox"
          aria-label="Cases"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault()
              moveFocus(1)
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault()
              moveFocus(-1)
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              activateFocused()
            } else if (event.key === "Escape") {
              event.preventDefault()
              onClose()
            } else if (event.key === "Home") {
              event.preventDefault()
              setFocusIndex(0)
            } else if (event.key === "End") {
              event.preventDefault()
              setFocusIndex(Math.max(0, visible.length - 1))
            }
          }}
        >
          {visible.length === 0 ? (
            <p className="case-library-empty">No cases match these filters.</p>
          ) : (
            visible.map((entry, index) => (
              <CaseCard
                key={entry.id}
                entry={entry}
                active={entry.id === activePatientId}
                focused={index === safeFocusIndex}
                onFocus={() => setFocusIndex(index)}
                onSelect={() => onSelect(entry.id)}
                onPrefetch={() => prefetchPatient(entry.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function CaseCard({
  entry,
  active,
  focused,
  onFocus,
  onSelect,
  onPrefetch,
}: {
  entry: PatientRecord
  active: boolean
  focused: boolean
  onFocus: () => void
  onSelect: () => void
  onPrefetch: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focused) ref.current?.focus()
  }, [focused])

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={active}
      className={["case-card", active ? "is-active" : "", focused ? "is-focused" : ""]
        .filter(Boolean)
        .join(" ")}
      onFocus={onFocus}
      onMouseEnter={onPrefetch}
      onFocusCapture={onPrefetch}
      onClick={onSelect}
    >
      <div className="case-card-top">
        <strong>{caseTitle(entry)}</strong>
        {active ? <span className="case-card-badge">Open</span> : null}
      </div>
      <p>{entry.summary ?? entry.label}</p>
      <Odontogram presentFdi={entry.presentFdi} label={`${caseTitle(entry)} tooth chart`} />
    </button>
  )
}
