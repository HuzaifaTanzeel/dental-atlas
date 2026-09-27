import { fdiTeeth, type FdiTooth } from "./fdi-teeth"

function searchTerm(query: string): string {
  return query.trim().toLowerCase().replace(/^fdi[\s-]*/, "")
}

function matchRank(tooth: FdiTooth, term: string): number | null {
  const fdi = String(tooth.fdi)
  const name = tooth.name.toLowerCase()
  if (fdi === term || name === term) return 0
  if (fdi.startsWith(term) || name.startsWith(term)) return 1
  if (name.includes(term) || fdi.includes(term)) return 2
  return null
}

export function searchFdiTeeth(query: string): FdiTooth[] {
  const teeth = Object.values(fdiTeeth).sort((a, b) => a.fdi - b.fdi)
  const term = searchTerm(query)
  if (!term) return teeth
  return teeth
    .flatMap((tooth) => {
      const rank = matchRank(tooth, term)
      return rank === null ? [] : [{ tooth, rank }]
    })
    .sort((a, b) => a.rank - b.rank || a.tooth.fdi - b.tooth.fdi)
    .map((entry) => entry.tooth)
}

export function missingToothMessage(tooth: FdiTooth): string {
  return `FDI ${tooth.fdi}, ${tooth.name}, is not in this scan.`
}
