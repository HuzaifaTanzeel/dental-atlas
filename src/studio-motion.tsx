import { motion, useReducedMotion } from "framer-motion"
import { Card } from "@/components/ui/card"

export const studioEase = [0.16, 1, 0.3, 1] as const

export const microTransition = { duration: 0.16, ease: studioEase }

export const panelTransition = { duration: 0.3, ease: studioEase }

export const MotionCard = motion.create(Card)

export function useStudioMotion() {
  const reduce = useReducedMotion()
  return {
    reduce: Boolean(reduce),
    micro: reduce ? { duration: 0 } : microTransition,
    panel: reduce ? { duration: 0 } : panelTransition,
  }
}
