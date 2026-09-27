export type ToothType = "incisor" | "canine" | "premolar" | "molar"
export type Arch = "upper" | "lower"
export type Side = "right" | "left"
export type Quadrant = 1 | 2 | 3 | 4

export type FdiTooth = {
  fdi: number
  name: string
  quadrant: Quadrant
  arch: Arch
  side: Side
  type: ToothType
}

const QUADRANTS: Record<Quadrant, { arch: Arch; side: Side; label: string }> = {
  1: { arch: "upper", side: "right", label: "Upper right" },
  2: { arch: "upper", side: "left", label: "Upper left" },
  3: { arch: "lower", side: "left", label: "Lower left" },
  4: { arch: "lower", side: "right", label: "Lower right" },
}

const DIGITS: Record<number, { type: ToothType; kind: string }> = {
  1: { type: "incisor", kind: "central incisor" },
  2: { type: "incisor", kind: "lateral incisor" },
  3: { type: "canine", kind: "canine" },
  4: { type: "premolar", kind: "first premolar" },
  5: { type: "premolar", kind: "second premolar" },
  6: { type: "molar", kind: "first molar" },
  7: { type: "molar", kind: "second molar" },
  8: { type: "molar", kind: "third molar" },
}

function buildFdiTable(): Record<number, FdiTooth> {
  const table: Record<number, FdiTooth> = {}
  for (const quadrant of [1, 2, 3, 4] as const) {
    const quadrantMeta = QUADRANTS[quadrant]
    for (let digit = 1; digit <= 8; digit += 1) {
      const kind = DIGITS[digit]
      const fdi = quadrant * 10 + digit
      table[fdi] = {
        fdi,
        name: `${quadrantMeta.label} ${kind.kind}`,
        quadrant,
        arch: quadrantMeta.arch,
        side: quadrantMeta.side,
        type: kind.type,
      }
    }
  }
  return table
}

export const fdiTeeth: Record<number, FdiTooth> = buildFdiTable()

export function getFdiTooth(fdi: number): FdiTooth {
  const tooth = fdiTeeth[fdi]
  if (!tooth) {
    throw new Error(`Unknown FDI number: ${fdi}`)
  }
  return tooth
}

const fdiNodeName = /^FDI-(\d+)$/

export function parseFdiNodeName(name: string): number | null {
  const match = fdiNodeName.exec(name)
  if (!match) return null
  const fdi = Number(match[1])
  return fdiTeeth[fdi] ? fdi : null
}
