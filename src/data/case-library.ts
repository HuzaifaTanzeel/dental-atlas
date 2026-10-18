import { getFdiTooth } from "./fdi-teeth"
import type { PatientRecord } from "./patients"

export type TagChip = {
  tag: string
  label: string
  count: number
}

export type CaseLibraryFilters = {
  tags: string[]
  query: string
}

const TAG_LABELS: Record<string, string> = {
  "complete-dentition": "Complete dentition",
  "single-missing": "Single missing",
  "multiple-missing": "Multiple missing",
  "anterior-missing": "Anterior missing",
  "posterior-missing": "Posterior missing",
  "third-molars-absent": "Third molars absent",
  "bilateral-pattern": "Bilateral pattern",
  "upper-only": "Upper arch only",
  "lower-only": "Lower arch only",
  "has-landmarks": "Has landmarks",
  "has-cusps": "Has cusp landmarks",
}

export function tagDisplayLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag.replace(/-/g, " ")
}

export function emptyCaseLibraryFilters(): CaseLibraryFilters {
  return { tags: [], query: "" }
}

/** Count how many cases carry each tag (across the full catalog). */
export function tagChipsFromPatients(cases: PatientRecord[]): TagChip[] {
  const counts = new Map<string, number>()
  for (const entry of cases) {
    for (const tag of entry.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, label: tagDisplayLabel(tag), count }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.tag.localeCompare(b.tag))
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ")
}

export function caseSearchText(entry: PatientRecord): string {
  const missingNames = (entry.missingFdi ?? []).map((fdi) => {
    try {
      return getFdiTooth(fdi).name
    } catch {
      return ""
    }
  })
  const archText = (entry.arches ?? []).join(" ")
  const landmarkText = entry.landmarks
    ? Object.entries(entry.landmarks)
        .flatMap(([arch, info]) => [arch, ...Object.keys(info.counts)])
        .join(" ")
    : ""
  return [
    entry.summary,
    entry.title,
    entry.label,
    archText,
    landmarkText,
    ...(entry.tags ?? []).map(tagDisplayLabel),
    ...missingNames,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase()
}

/**
 * Filter cases by selected tags (AND) and a free-text query.
 * Query tokens are AND-matched against summary, title, label, tag labels, and
 * missing-tooth names so "lower molar" finds the right cards.
 */
export function filterCases(cases: PatientRecord[], filters: CaseLibraryFilters): PatientRecord[] {
  const selected = filters.tags
  const query = normalizeSearchQuery(filters.query)
  const tokens = query ? query.split(" ").filter(Boolean) : []
  return cases.filter((entry) => {
    if (selected.length > 0) {
      const have = new Set(entry.tags ?? [])
      if (!selected.every((tag) => have.has(tag))) return false
    }
    if (tokens.length === 0) return true
    const haystack = caseSearchText(entry)
    return tokens.every((token) => haystack.includes(token))
  })
}

export function toggleTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((entry) => entry !== tag) : [...tags, tag]
}

export function parseTagsParam(value: string | null): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

export function serializeTagsParam(tags: string[]): string {
  return tags.join(",")
}

export function caseTitle(entry: PatientRecord, indexHint?: number): string {
  if (entry.title?.trim()) return entry.title.trim()
  const match = /^patient-(\d+)$/i.exec(entry.id)
  if (match) return `Case ${Number(match[1])}`
  if (typeof indexHint === "number") return `Case ${indexHint + 1}`
  return entry.label
}
