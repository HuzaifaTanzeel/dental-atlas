import { useId } from "react"

/** Permanent FDI chart order (viewer’s left → right). */
const UPPER_ROW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const
const LOWER_ROW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const

type OdontogramProps = {
  presentFdi?: number[]
  className?: string
  label?: string
}

function toothPath(cx: number, cy: number, digit: number): string {
  const wide = digit >= 6
  const rx = wide ? 4.2 : 3.2
  const ry = wide ? 5.1 : 4.4
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`
}

/**
 * Compact SVG adult odontogram. Present teeth are filled; missing stay hollow outlines.
 * No 3D / mesh loading — only FDI presence from the manifest.
 */
export function Odontogram({ presentFdi, className, label = "Tooth chart" }: OdontogramProps) {
  const reactId = useId()
  const titleId = `${reactId}-title`
  const present = new Set(presentFdi ?? [])

  const renderRow = (row: readonly number[], y: number) =>
    row.map((fdi, index) => {
      const digit = fdi % 10
      const cx = 10 + index * 11 + (index >= 8 ? 4 : 0)
      const filled = present.has(fdi)
      return (
        <path
          key={fdi}
          d={toothPath(cx, y, digit)}
          className={filled ? "odontogram-tooth is-present" : "odontogram-tooth is-missing"}
        >
          <title>{`FDI ${fdi}${filled ? " present" : " missing"}`}</title>
        </path>
      )
    })

  return (
    <svg
      className={["odontogram", className].filter(Boolean).join(" ")}
      viewBox="0 0 186 36"
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{label}</title>
      <g aria-hidden="true">
        {renderRow(UPPER_ROW, 10)}
        {renderRow(LOWER_ROW, 26)}
        <line className="odontogram-midline" x1="93" y1="2" x2="93" y2="34" />
      </g>
    </svg>
  )
}
