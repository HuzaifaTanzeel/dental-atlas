import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "cn"
import { microTransition } from "@/studio-motion"

function Switch({
  className,
  size = "default",
  checked,
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  const reduce = useReducedMotion()
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={checked}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#538d9a] data-[size=default]:h-[18px] data-[size=default]:w-8 data-[size=sm]:h-[14px] data-[size=sm]:w-6 data-checked:bg-[#263b48] data-unchecked:bg-[#d5dbe1] data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute top-[2px] left-[2px] block size-[14px] rounded-full bg-transparent group-data-[size=sm]/switch:size-3"
      >
        <motion.span
          className="block size-full rounded-full bg-white shadow-[0_1px_2px_#18253622]"
          initial={false}
          animate={{ x: checked ? (size === "sm" ? 10 : 14) : 0 }}
          transition={reduce ? { duration: 0 } : microTransition}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
