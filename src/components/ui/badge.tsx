import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** The small mono "pill" used for crop stages, PHI locks, budgets and legends. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[6px] font-mono font-bold",
  {
    variants: {
      variant: {
        neutral: "bg-chip text-ink-muted",
        leaf: "bg-leaf-tint text-leaf-deep",
        water: "bg-water-tint text-water-deep",
        sun: "bg-sun-tint text-sun-ink",
        sunOutline: "border border-sun bg-sun-tint-2 text-sun-ink",
        clay: "bg-clay-tint text-clay",
        ink: "bg-ink text-cream",
        earth: "bg-chip-2 text-sun-ink-2",
      },
      size: {
        xs: "px-[7px] py-[2.5px] text-[9.5px]",
        sm: "px-[7px] py-[3px] text-[10.5px]",
        md: "px-[10px] py-[5px] text-[11px]",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
