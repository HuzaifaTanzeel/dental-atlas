import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, ChevronRight, Focus, X } from "lucide-react"
import { getFdiTooth, type FdiTooth } from "@/data/fdi-teeth"
import { SCAN_NOTE, toothSummary } from "@/data/tooth-notes"
import { StudioButton } from "@/components/StudioButton"
import { TOOTH_LAYERS } from "@/studio-state"
import { useStudioMotion } from "@/studio-motion"

function quadrantLabel(tooth: FdiTooth): string {
  const arch = tooth.arch === "upper" ? "Upper" : "Lower"
  const side = tooth.side === "left" ? "left" : "right"
  return `${arch} ${side}`
}

function typeLabel(tooth: FdiTooth): string {
  return tooth.type.charAt(0).toUpperCase() + tooth.type.slice(1)
}

type ToothDetailPanelProps = {
  fdi: number
  isolated: boolean
  onClose: () => void
  onToggleIsolate: () => void
}

export function ToothDetailPanel({ fdi, isolated, onClose, onToggleIsolate }: ToothDetailPanelProps) {
  const tooth = getFdiTooth(fdi)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const accent = TOOTH_LAYERS.find((layer) => layer.id === tooth.type)?.color ?? "#5d7c9a"
  const { reduce, panel } = useStudioMotion()

  useEffect(() => {
    titleRef.current?.focus()
  }, [fdi])

  return (
    <div className="detail-frame">
      <StudioButton type="button" className="sheet-close" onClick={onClose} aria-label="Clear selection">
        <X size={16} aria-hidden="true" />
      </StudioButton>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tooth.fdi}
          className="detail-swap"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={panel}
        >
          <div className="detail-header">
            <div className="detail-accent" style={{ background: accent }} />
            <div className="eyebrow">FDI {tooth.fdi}</div>
            <h2 ref={titleRef} tabIndex={-1} className="structure-title">
              {tooth.name}
            </h2>
          </div>
          <div className="detail-scroll">
            <p className="structure-description">{toothSummary(tooth)}</p>
            <p className="context-note">{SCAN_NOTE}</p>
            <div className="structure-meta">
              <span>
                Quadrant
                <strong>
                  {quadrantLabel(tooth)} · Q{tooth.quadrant}
                </strong>
              </span>
              <span>
                Type
                <strong>{typeLabel(tooth)}</strong>
              </span>
            </div>
            <a className="source-link" href="https://crns-smartvision.github.io/teeth3ds/" target="_blank" rel="noreferrer">
              View dataset source <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="detail-actions">
        <StudioButton type="button" className={`primary-action${isolated ? " active" : ""}`} onClick={onToggleIsolate}>
          <Focus size={16} aria-hidden="true" />
          {isolated ? "Show surrounding teeth" : "Isolate tooth"}
          <ChevronRight size={16} aria-hidden="true" />
        </StudioButton>
        <StudioButton type="button" className="secondary-action" onClick={onClose}>
          Clear selection
        </StudioButton>
      </div>
    </div>
  )
}
