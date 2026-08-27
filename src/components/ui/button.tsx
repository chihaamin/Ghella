import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Ghella button. The variants are the five button treatments that actually
 * appear in the design: dark ink, leaf green, sun amber, an outline and a
 * "light on dark card" pair used inside the ink-coloured panels.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] font-sans font-bold transition-colors outline-none select-none cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        ink: "bg-ink text-surface hover:bg-ink/90",
        leaf: "bg-leaf text-white hover:bg-leaf-deep",
        sun: "bg-sun text-ink font-extrabold hover:bg-sun/90",
        sunDeep: "bg-sun-deep text-white hover:bg-sun-deep/90",
        outline:
          "border-[1.5px] border-line-strong bg-transparent font-semibold text-muted hover:bg-chip/60",
        ghost: "bg-transparent font-semibold text-muted hover:bg-chip/60",
        light: "bg-surface text-ink hover:bg-white",
        outlineOnDark:
          "border-[1.5px] border-surface/40 bg-transparent text-surface hover:bg-surface/10",
        muted: "bg-chip text-ink hover:bg-line",
        disabled: "bg-line text-sand",
      },
      size: {
        /** Full-bleed primary CTA — the 13–14px vertical padding in the source. */
        lg: "h-[46px] w-full px-4 text-[14px]",
        md: "h-[40px] px-4 text-[13.5px]",
        sm: "h-[34px] px-3 text-[12.5px] rounded-[9px]",
        chip: "h-[31px] px-[11px] text-[12px] rounded-[9px]",
      },
    },
    defaultVariants: { variant: "ink", size: "lg" },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
