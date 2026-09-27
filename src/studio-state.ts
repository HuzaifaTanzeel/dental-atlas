export const ARCHES = [
  { id: "upper", name: "Upper arch", color: "#8d6f86" },
  { id: "lower", name: "Lower arch", color: "#3f7c86" },
] as const

export const TOOTH_LAYERS = [
  { id: "incisor", name: "Incisors", color: "#c6a15a" },
  { id: "canine", name: "Canines", color: "#d08a62" },
  { id: "premolar", name: "Premolars", color: "#6e9084" },
  { id: "molar", name: "Molars", color: "#5d7c9a" },
] as const

export const GINGIVA_LAYER = { id: "gingiva", name: "Gingiva", color: "#c45c58" } as const

export type ArchId = (typeof ARCHES)[number]["id"]
export type ToothLayerId = (typeof TOOTH_LAYERS)[number]["id"]
export type StudioView = "three-quarter" | "occlusal" | "front" | "side"

export type StudioState = {
  arches: ArchId[]
  layers: ToothLayerId[]
  gingiva: boolean
  view: StudioView
  rotate: boolean
  explode: number
  isolate: boolean
  reset: number
}

export const initialStudio: StudioState = {
  arches: ["lower"],
  layers: ["incisor", "canine", "premolar", "molar"],
  gingiva: true,
  view: "three-quarter",
  rotate: false,
  explode: 0,
  isolate: false,
  reset: 0,
}

export const STUDIO_VIEWS: { id: StudioView; label: string; title: string }[] = [
  { id: "three-quarter", label: "¾", title: "Three-quarter view" },
  { id: "occlusal", label: "O", title: "Occlusal view" },
  { id: "front", label: "F", title: "Front view" },
  { id: "side", label: "S", title: "Side view" },
]
