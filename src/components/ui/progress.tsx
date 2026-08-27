import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

/**
 * Track + indicator, with the indicator animated on value change so growth
 * reads as growth (the design's `gh-bar` keyframe).
 */
function Progress({
  className,
  indicatorClassName,
  value = 0,
  trackHeight = 7,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
  trackHeight?: number
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative w-full overflow-hidden rounded-full bg-chip", className)}
      style={{ height: trackHeight }}
      {...props}
    >
      <ProgressPrimitive.Indicator asChild>
        <motion.div
          className={cn("h-full rounded-full bg-leaf", indicatorClassName)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(value ?? 0, 0), 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
