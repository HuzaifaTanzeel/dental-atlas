import { motion, useReducedMotion } from "framer-motion"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { microTransition } from "@/studio-motion"

export function StudioButton({ disabled, ...props }: ComponentProps<typeof Button>) {
  const reduce = useReducedMotion()
  return (
    <Button
      disabled={disabled}
      render={
        <motion.button
          whileHover={reduce || disabled ? undefined : { y: -1 }}
          whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
          transition={microTransition}
        />
      }
      {...props}
    />
  )
}
