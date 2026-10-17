import { useState } from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import type { FdiTooth } from "@/data/fdi-teeth"
import { TOOTH_LAYERS } from "@/studio-state"
import { StudioButton } from "@/components/StudioButton"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { microTransition, studioEase, useStudioMotion } from "@/studio-motion"

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
  const { reduce } = useStudioMotion()
  const [highlighted, setHighlighted] = useState("")
  const note = !scanReady
    ? "The scan is still loading."
    : query.trim()
      ? "Matches from the FDI chart. Teeth missing from this scan stay in the list."
      : "All 32 permanent teeth. Missing ones stay in the list."

  return (
    <>
      <div className="panel-heading">
        <span>Find a tooth</span>
        <StudioButton type="button" className="icon-button" aria-label="Close search" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </StudioButton>
      </div>
      <Command shouldFilter={false} loop onValueChange={setHighlighted} label="Find a tooth">
        <CommandInput
          autoFocus
          aria-label="Search teeth by name or FDI number"
          placeholder="Molar, canine, 36…"
          value={query}
          onValueChange={onQueryChange}
        />
        <CommandList className="search-results">
          <CommandEmpty className="search-note">No teeth match that search.</CommandEmpty>
          {results.map((tooth, index) => {
            const absent = scanReady && !presentFdi.has(tooth.fdi)
            const accent = TOOTH_LAYERS.find((layer) => layer.id === tooth.type)?.color
            const value = String(tooth.fdi)
            return (
              <CommandItem
                key={tooth.fdi}
                value={value}
                className={absent ? "is-absent" : undefined}
                onSelect={() => onPick(tooth.fdi)}
              >
                {highlighted === value ? (
                  <motion.span
                    layoutId="search-highlight"
                    className="search-row-highlight"
                    transition={reduce ? { duration: 0 } : microTransition}
                  />
                ) : null}
                <motion.span
                  className="search-result-body"
                  initial={reduce ? false : { opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduce ? 0 : 0.18,
                    ease: studioEase,
                    delay: reduce ? 0 : Math.min(index, 12) * 0.04,
                  }}
                >
                  <span className="system-dot" style={{ background: accent }} />
                  <span className="search-result-name">{tooth.name}</span>
                  <span className="small-number">{absent ? "Not in this scan" : `FDI ${tooth.fdi}`}</span>
                </motion.span>
              </CommandItem>
            )
          })}
        </CommandList>
      </Command>
      {notice ? <p className="search-miss">{notice}</p> : null}
      <p className="search-note">{note}</p>
    </>
  )
}
