import { X } from "lucide-react"
import { getFdiTooth, type FdiTooth } from "@/data/fdi-teeth"

function quadrantLabel(tooth: FdiTooth): string {
  const arch = tooth.arch === "upper" ? "Upper" : "Lower"
  const side = tooth.side === "left" ? "left" : "right"
  return `${arch} ${side} · Q${tooth.quadrant}`
}

function typeLabel(tooth: FdiTooth): string {
  return tooth.type.charAt(0).toUpperCase() + tooth.type.slice(1)
}

type ToothDetailPanelProps = {
  fdi: number
  onClose: () => void
}

export function ToothDetailPanel({ fdi, onClose }: ToothDetailPanelProps) {
  const tooth = getFdiTooth(fdi)

  return (
    <aside
      aria-label={`Selected tooth, FDI ${tooth.fdi}`}
      className="pointer-events-auto absolute z-30 overflow-y-auto rounded-lg border border-border bg-background px-4 py-4 text-[#1c1f24] inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-h-[48dvh] max-md:landscape:inset-x-auto max-md:landscape:top-16 max-md:landscape:right-4 max-md:landscape:bottom-16 max-md:landscape:w-72 max-md:landscape:max-h-[calc(100dvh-8rem)] md:inset-x-auto md:top-28 md:right-7 md:bottom-auto md:w-[18.75rem] md:max-h-[calc(100dvh-10rem)]"
    >
      <button
        type="button"
        className="absolute top-2 right-2 grid size-11 place-items-center rounded-md text-[#1c1f24]/70 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={onClose}
        aria-label="Clear selection"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <p className="pr-10 text-[11px] font-medium tracking-[0.16em] text-[#1c1f24]/70">FDI {tooth.fdi}</p>
      <h2 className="mt-1 pr-10 text-xl leading-tight font-medium tracking-tight">{tooth.name}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <dt className="text-[11px] tracking-wide text-[#1c1f24]/70">Quadrant</dt>
          <dd className="mt-1 text-sm">{quadrantLabel(tooth)}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-wide text-[#1c1f24]/70">Type</dt>
          <dd className="mt-1 text-sm">{typeLabel(tooth)}</dd>
        </div>
      </dl>
    </aside>
  )
}
