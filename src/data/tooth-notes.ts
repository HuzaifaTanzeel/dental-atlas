import type { FdiTooth, ToothType } from "@/data/fdi-teeth"

const TYPE_NOTES: Record<ToothType, string> = {
  incisor:
    "Incisors are the front cutting teeth. They take the first bite and form the edge of the arch you see when someone smiles.",
  canine:
    "Canines sit at the corners of the arch. The pointed crown guides the bite as the jaw slides from side to side.",
  premolar:
    "Premolars stand between the canines and the molars. They hold and crush food before the molars grind it.",
  molar:
    "Molars are the broad teeth at the back of the arch. Their cusps grind food. A third molar, when it is present, is a wisdom tooth.",
}

export const SCAN_NOTE = "Intraoral scan of the crown surface. Roots and bone are not in this model."

export function toothSummary(tooth: FdiTooth): string {
  return TYPE_NOTES[tooth.type]
}
